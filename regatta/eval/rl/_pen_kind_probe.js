// Penalty-source census, and the direct measurement behind the two remaining
// `state.time`-as-seconds bugs (PHASE D, MEASURE ONLY — landing them is the
// owner's rules call).
//
// Reports, per venue: penalties by kind and rule, and specifically for the
// NO-CONTACT foul path (the one gated by `foulCooldowns[id] = state.time + 20`,
// which is really 83 real seconds): how many fire, and how many repeat on the
// SAME PAIR inside 20s / 83s. The gap between those two counts is exactly what
// shortening the cooldown to its intended length would unlock.
//
// node _pen_kind_probe.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay';
const TRIALS = parseInt(process.argv[3]) || 8;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeA');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => {
        const inner = window.onRaceEvent;
        window.__pen = [];
        window.onRaceEvent = (ty, d) => {
            try {
                if (ty === 'penalty' && d && d.boat) {
                    // The threat pairing is the controller's own current view — the
                    // no-contact detector penalises exactly this.threatBoat.
                    window.__pen.push({
                        t: state.race.timer, kind: d.kind || 'contact', rule: d.rule || '',
                        boat: d.boat.id,
                        // whoever was holding a stand-on claim against them
                        by: (() => {
                            for (const b of state.boats) {
                                const c = b.controller;
                                if (c && c.threatBoat === d.boat && c.avoidanceRole === 'STAND_ON') return b.id;
                            }
                            return null;
                        })(),
                    });
                }
            } catch (e) {}
            return inner && inner(ty, d);
        };
    });

    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, venue]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            window.__pen = [];
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer);
            if (pl) { pl.x = venue === 'arctic' ? -4500 : 5900; pl.y = venue === 'arctic' ? 4700 : -6100; }
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 900) break;
            }
            return { pen: window.__pen, n: bots.length };
        }, [seed, VENUE]);
        all.push({ seed, ...r });
        console.log(`seed ${seed}: ${r.pen.length} penalties`);
    }
    await browser.close();

    const flat = all.flatMap(r => r.pen.map(p => ({ ...p, seed: r.seed })));
    const nBoats = all.reduce((a, r) => a + r.n, 0);
    const byKind = {}, byRule = {};
    for (const p of flat) { byKind[p.kind] = (byKind[p.kind] || 0) + 1; byRule[p.rule] = (byRule[p.rule] || 0) + 1; }
    console.log(`\nPENALTY CENSUS — ${VENUE}, ${TRIALS} seeds, ${nBoats} boat-races`);
    console.log(`  total ${flat.length} = ${(flat.length / nBoats).toFixed(2)}/boat-race`);
    console.log(`  by kind: ${Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
    console.log(`  by rule: ${Object.entries(byRule).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k || '(none)'} ${v}`).join(' | ')}`);

    // Repeat analysis on the no-contact path: same (victim, claimant) pair.
    const nc = flat.filter(p => p.kind === 'no_contact' && p.by != null);
    const lastSeen = {};
    let within20 = 0, within83 = 0;
    for (const p of nc.slice().sort((a, b) => a.seed - b.seed || a.t - b.t)) {
        const k = `${p.seed}:${p.by}->${p.boat}`;
        if (lastSeen[k] != null) {
            const dt = p.t - lastSeen[k];
            if (dt < 20) within20++;
            if (dt < 83) within83++;
        }
        lastSeen[k] = p.t;
    }
    console.log(`  NO-CONTACT fouls: ${nc.length} with an identifiable claimant` +
        ` (${(nc.length / nBoats).toFixed(2)}/boat-race)`);
    console.log(`  same-pair repeats: within 20s ${within20} | within 83s ${within83}` +
        `  -> shortening the cooldown 83s->20s could unlock at most ${within83 - within20} extra fouls`);
})();
