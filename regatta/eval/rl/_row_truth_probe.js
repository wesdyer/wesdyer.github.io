// DOES THE RULES ENGINE GET RIGHT-OF-WAY RIGHT?
//
// Two suspected foundational bugs, both measured here against the definitions:
//
// 1. `getTack` reads `boat.boomSide`, which script.js EASES between -1 and +1 as
//    an animation (`boomSide += (targetBoomSide - boomSide) * swingSpeed`). The
//    definition says a boat is on the tack corresponding to her WINDWARD SIDE —
//    an angle to the wind, not a boom position. During every tack and gybe the
//    animated value crosses zero at a different moment than the boat crosses the
//    wind, so rule 10 (the most fundamental ROW rule) can be decided from a boom
//    that has not caught up. (The definition DOES make the mainsail side
//    decisive when sailing by the lee or dead downwind — so the correct test is
//    angle-based EXCEPT there.)
//
// 2. `getLeewardBoat` reads `state.wind.direction` — the GLOBAL course-centroid
//    blend. Root cause #2 of this entire campaign was that this value is ~110
//    degrees adrift of the local wind on arctic. The AI was moved to getWindAt;
//    the RULES ENGINE never was. Rule 11 (windward/leeward) is decided by it.
//
// For every close pair each tick, compares the engine's verdict to the same
// verdict computed from LOCAL wind and from an angle-based tack.
//
// node _row_truth_probe.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const VENUE = process.argv[5] || 'arctic';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const T = { pairs: 0, tackDiff: 0, leewardDiff: 0, windDelta: [], oppDiff: 0, bothTacking: 0, sternAhead: 0 };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, venue]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer);
            if (pl) { pl.x = venue === 'arctic' ? -4500 : 5900; pl.y = venue === 'arctic' ? 4700 : -6100; }
            const acc = { pairs: 0, tackDiff: 0, leewardDiff: 0, windDelta: [], oppDiff: 0, bothTacking: 0, sternAhead: 0 };
            const dt = 1 / 60;
            const tackByAngle = (b) => {
                const w = getWindAt(b.x, b.y).direction;
                // windward side from the wind angle; by-the-lee/dead-downwind is
                // the one case the definition makes the mainsail side decisive
                const twa = normalizeAngle(b.heading - w);
                if (Math.abs(twa) > 2.9) return b.boomSide > 0 ? 1 : -1;   // by the lee
                // ⚠️ SIGN VERIFIED EMPIRICALLY, not derived: with the boom settled
                // and head-to-wind/by-the-lee excluded, sign(TWA) vs sign(boomSide)
                // is perfectly separated — twa<0 <-> boom+ (1499 samples) and
                // twa>0 <-> boom- (830), zero counter-examples. boom+ is STARBOARD
                // per the engine, so TWA < 0 is starboard tack. Getting this
                // backwards made a first run of this probe report a 99.4% tack
                // disagreement that was entirely the probe's own convention.
                return twa < 0 ? 1 : -1;
            };
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (it % 30) continue;                       // 2Hz sample
                for (let i2 = 0; i2 < bots.length; i2++) for (let j = i2 + 1; j < bots.length; j++) {
                    const a = bots[i2], b = bots[j];
                    if (a.raceState.finished || b.raceState.finished) continue;
                    if (Math.hypot(a.x - b.x, a.y - b.y) > 300) continue;
                    acc.pairs++;
                    // 1. tack: engine (boomSide) vs angle-based on LOCAL wind
                    const eTa = window.Rules.getTack(a), eTb = window.Rules.getTack(b);
                    const aTa = tackByAngle(a), aTb = tackByAngle(b);
                    if (eTa !== aTa || eTb !== aTb) acc.tackDiff++;
                    if ((eTa !== eTb) !== (aTa !== aTb)) acc.oppDiff++;
                    if (a.raceState.isTacking && b.raceState.isTacking) acc.bothTacking++;
                    // 2. leeward: engine (GLOBAL wind) vs the same math on LOCAL wind
                    const wl = getWindAt((a.x + b.x) / 2, (a.y + b.y) / 2).direction;
                    const wg = state.wind.direction;
                    acc.windDelta.push(Math.abs(normalizeAngle(wl - wg)));
                    const lee = (wd, first) => {
                        const dx = b.x - a.x, dy = b.y - a.y;
                        const wx = Math.sin(wd), wy = -Math.cos(wd);
                        const dot = dx * (-wy) + dy * wx;
                        return (first === 1) ? (dot > 0 ? a : b) : (dot > 0 ? b : a);
                    };
                    if (lee(wg, eTa) !== lee(wl, aTa)) acc.leewardDiff++;
                    // 3. clear-astern: does testing only the BOW mis-rank when the
                    //    behind boat's STERN projects further forward?
                    const ext = (bt, fx, fy, ox, oy) => {
                        const s = Math.sin(bt.heading), c = Math.cos(bt.heading);
                        const bowX = bt.x + 25 * s, bowY = bt.y - 25 * c;
                        const stX = bt.x - 30 * s, stY = bt.y + 30 * c;
                        return Math.max((bowX - ox) * fx + (bowY - oy) * fy,
                                        (stX - ox) * fx + (stY - oy) * fy)
                             > (bowX - ox) * fx + (bowY - oy) * fy + 1e-6;
                    };
                    for (const [bh, ah] of [[a, b], [b, a]]) {
                        const s = Math.sin(ah.heading), c = Math.cos(ah.heading);
                        if (ext(bh, s, -c, ah.x - 30 * s, ah.y + 30 * c)) { acc.sternAhead++; break; }
                    }
                }
            }
            return acc;
        }, [seed, VENUE]);
        T.pairs += r.pairs; T.tackDiff += r.tackDiff; T.leewardDiff += r.leewardDiff;
        T.oppDiff += r.oppDiff; T.bothTacking += r.bothTacking; T.sternAhead += r.sternAhead;
        T.windDelta.push(...r.windDelta);
        console.log(`seed ${seed}: ${r.pairs} close-pair samples`);
    }
    await browser.close();
    const deg = r => (r * 180 / Math.PI);
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
    const pc = n => `${n} (${(100 * n / T.pairs).toFixed(1)}%)`;
    console.log(`\nROW TRUTH — ${VENUE}, ${TRIALS} seeds, ${T.pairs} close-pair samples (<300u, 2Hz)`);
    console.log(`  TACK differs from the angle-based truth:        ${pc(T.tackDiff)}`);
    console.log(`  ...and that FLIPS the opposite-tacks test (r10): ${pc(T.oppDiff)}`);
    console.log(`  LEEWARD boat differs on local vs global wind (r11): ${pc(T.leewardDiff)}`);
    console.log(`  local-vs-global wind angle: med ${deg(med(T.windDelta)).toFixed(1)}°  ` +
                `p90 ${deg(q(T.windDelta, .9)).toFixed(1)}°  max ${deg(q(T.windDelta, 1)).toFixed(1)}°`);
    console.log(`  pairs where a STERN projects ahead of the bow (clear-astern bow-only test wrong): ${pc(T.sternAhead)}`);
    console.log(`  both boats tacking at once (rule 13 side case): ${pc(T.bothTacking)}`);
})();
