// WHEN THE NO-CONTACT FOUL FIRES, WAS SHE ACTUALLY FORCED?
//
// Owner's standard for this rule: "if the boat with rights NEEDS to adjust (not just
// chooses to) then it is a penalty." That is the Keep Clear definition part (a) — "a
// boat keeps clear of a right-of-way boat if the right-of-way boat can sail her course
// with no need to take avoiding action" — and NEED is the whole word. The detector
// currently asks for a sustained 20-degree deviation at HIGH risk, which is a proxy for
// need, and a loose one: the fleet was measured deflecting a median 11-23 degrees when
// the deflection actually required was 0.
//
// This measures the thing itself. At the moment a foul fires, it reconstructs what
// would have happened had the right-of-way boat held her PROPER COURSE — the undeflected
// heading, which is exactly `desiredHeading` before applyAvoidance — against the
// give-way boat continuing on hers, and asks whether they would have come within a hull
// width. If they would, she needed to adjust and the foul is correct. If they would have
// passed clear, the foul is punishing her own timidity.
//
//   correct   holding her course leads to contact  -> she NEEDED to adjust
//   timid     holding her course passes clear      -> the foul is wrong
//
// node _foul_truth_probe.js <trials> <seed0> <tree> [venue] [dev] [hold]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBase');
const VENUE = process.argv[5] || 'bay';
const DEV = process.argv[6] != null ? parseFloat(process.argv[6]) : null;
const HOLD = process.argv[7] != null ? parseFloat(process.argv[7]) : null;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    let tot = { fouls: 0, correct: 0, correctMin: 0, timid: 0, contacts: 0, gaps: [], gapsMin: [] };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, venue, dev, hold]) => {
            if (dev != null || hold != null) {
                window.__RULES = window.__RULES || {};
                if (dev != null) window.__RULES.dev = dev;
                if (hold != null) window.__RULES.hold = hold;
            }
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            if (pl) { pl.x = venue === 'arctic' ? -4500 : 5900; pl.y = venue === 'arctic' ? 4700 : -6100; }
            const out = { fouls: 0, correct: 0, correctMin: 0, timid: 0, contacts: 0, gaps: [], gapsMin: [] };
            const prev = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_boat') out.contacts++;
                    if (ty === 'penalty' && d && (d.kind === 'no_contact' || d.kind === 'no-contact')) {
                        // ⚠️ ONE COUNT PER EPISODE. triggerPenalty fires this event on
                        // every eligible frame and only converts it into a turn when the
                        // boat is not already flagged, so counting raw events weights a
                        // single long grinding episode as hundreds of fouls — 577 events
                        // in 8 arctic races against a real penalty rate near 1.5 a boat.
                        // The flag is set AFTER the event, so it still reads false here
                        // on the frame that counts.
                        if (d.boat.raceState.penalty) return;
                        out.fouls++;
                        // The right-of-way boat is the one that claimed the foul; the
                        // penalised boat is the give-way boat. Reconstruct the pass on
                        // proper courses.
                        const gw = d.boat;
                        let row = null, best = 1e9;
                        for (const b of state.boats) {
                            if (b === gw || b.raceState.finished) continue;
                            const c = b.controller || b.ai;
                            if (!c || c.threatBoat !== gw) continue;
                            const dd = Math.hypot(b.x - gw.x, b.y - gw.y);
                            if (dd < best) { best = dd; row = b; }
                        }
                        if (!row) return;
                        const c = row.controller || row.ai;
                        // Her PROPER COURSE is the undeflected candidate: the heading
                        // avoidance was applied to. lastAvoidDeviation is the size of the
                        // push, and her current heading is the pushed one.
                        const dev0 = c.lastAvoidDeviation || 0;
                        // Two reconstructions, one each way — applyAvoidance records the
                        // SIZE of the push but not its sign, so both are reported: the
                        // larger gap is the reading least favourable to the claim, the
                        // smaller the one most favourable. If even the FAVOURABLE
                        // reconstruction passes clear, the foul is wrong under any
                        // reading, and that is the number to trust.
                        let gap = 0, gapMin = 1e9;
                        for (const sgn of [1, -1]) {
                            const h0 = row.heading + sgn * dev0;
                            let g = 1e9;
                            for (let t = 0; t <= 6; t += 0.25) {
                                const ax = row.x + Math.sin(h0) * row.speed * 60 * t;
                                const ay = row.y - Math.cos(h0) * row.speed * 60 * t;
                                const bx = gw.x + Math.sin(gw.heading) * gw.speed * 60 * t;
                                const by = gw.y - Math.cos(gw.heading) * gw.speed * 60 * t;
                                const dd = Math.hypot(ax - bx, ay - by);
                                if (dd < g) g = dd;
                            }
                            if (g > gap) gap = g;
                            if (g < gapMin) gapMin = g;
                        }
                        out.gaps.push(Math.round(gap));
                        out.gapsMin.push(Math.round(gapMin));
                        if (gap < 55) out.correct++; else out.timid++;
                        if (gapMin < 55) out.correctMin++;
                    }
                } catch (e) { /* diagnostic only */ }
                if (prev) prev(ty, d);
            };
            for (let it = 0; it < 60 * 940; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 900) break;
            }
            window.onRaceEvent = prev;
            return out;
        }, [seed, VENUE, DEV, HOLD]);
        tot.fouls += r.fouls; tot.correct += r.correct; tot.timid += r.timid;
        tot.contacts += r.contacts; tot.gaps.push(...r.gaps); tot.correctMin += r.correctMin; tot.gapsMin.push(...r.gapsMin);
        console.log(`seed ${seed}: ${r.fouls} no-contact fouls, ${r.contacts} contacts`);
    }
    await browser.close();
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    console.log(`\nFOUL TRUTH — ${VENUE}, tree ${path.basename(ROOT)}, ${TRIALS} seeds` +
                (DEV != null || HOLD != null ? `, dev=${DEV} hold=${HOLD}` : ', shipped thresholds'));
    console.log(`  no-contact fouls fired            ${tot.fouls}   (against ${tot.contacts} boat contacts)`);
    if (tot.fouls) {
        console.log(`  CORRECT (holding her course hits) ${tot.correct} (${(100 * tot.correct / tot.fouls).toFixed(0)}%)`);
        console.log(`  TIMID   (it would have passed)    ${tot.timid} (${(100 * tot.timid / tot.fouls).toFixed(0)}%)`);
        console.log(`  CORRECT under the MOST FAVOURABLE reconstruction ${tot.correctMin} (${(100 * tot.correctMin / tot.fouls).toFixed(0)}%)`);
        console.log(`  gap on proper courses, least favourable  med ${med(tot.gaps)}u  min ${Math.min(...tot.gaps)}u`);
        console.log(`  gap on proper courses, most favourable   med ${med(tot.gapsMin)}u  min ${Math.min(...tot.gapsMin)}u`);
    }
})();
