// PHASE C — BAY BOAT-RUB ATTRIBUTION.
// Bay bots log 2.32 boat contacts per race against a recorded human 0.14. This
// asks WHERE they come from, in the same shape the transit probe asked of the
// arctic: per contact episode (0.5s dedup per pair), the leg, the phase, the
// distance to the nearest mark and whether either boat was inside its zone, the
// encounter geometry (overtaking / crossing / parallel rub, by relative heading
// and bearing), the closing speed, and the rules engine's OWN standing verdict.
//
// ⚠️ Read-only by construction. The ROW verdict is READ from
// Rules.interactions[key].rowOwner — the engine's persisted answer — never by
// calling evaluate(), which writes rowOwner/rowChangeTime and would perturb the
// race it is measuring.
//
// node _bay_rub_probe.js <trials> <seed0> <tree> <label>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const LABEL = process.argv[5] || null;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => {
        const inner = window.onRaceEvent;
        window.__rub = []; window.__rubT = {};
        const mono = () => state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
        window.onRaceEvent = (ty, d) => {
            try {
                if (ty === 'collision_boat' && d && d.boat && d.other
                    && !d.boat.isPlayer && !d.other.isPlayer) {
                    const a = d.boat, b = d.other;
                    const key = [a.id, b.id].sort((x, y) => x - y).join('-');
                    const t = mono();
                    // One record per PAIR per episode (the engine fires both ways).
                    if (window.__rubT[key] == null || t - window.__rubT[key] >= 0.5) {
                        window.__rubT[key] = t;
                        const rs = a.raceState;
                        // Nearest mark and zone membership — is this a rounding rub?
                        let mDist = 9e9, mName = '', inZone = false;
                        for (const m of (state.course.marks || [])) {
                            const dd = Math.hypot(m.x - a.x, m.y - a.y);
                            if (dd < mDist) { mDist = dd; mName = m.name || m.id || '?'; }
                            const z = m.zone || 0;
                            if (z && dd < z) inZone = true;
                        }
                        // Geometry: relative heading (same way vs crossing vs head-on)
                        // and where the other boat sits relative to our bow.
                        const dh = Math.abs(Math.atan2(Math.sin(b.heading - a.heading),
                                                       Math.cos(b.heading - a.heading)));
                        const brg = Math.atan2(b.x - a.x, -(b.y - a.y));
                        const rel = Math.abs(Math.atan2(Math.sin(brg - a.heading),
                                                        Math.cos(brg - a.heading)));
                        let geom;
                        if (dh < 0.6) geom = rel < 1.2 ? 'overtaking' : (rel > 1.94 ? 'overtaken' : 'parallel');
                        else if (dh > 2.4) geom = 'headon';
                        else geom = 'crossing';
                        const ia = window.Rules && window.Rules.interactions
                            ? window.Rules.interactions[key] : null;
                        const rowOwner = ia ? ia.rowOwner : null;
                        window.__rub.push({
                            t, leg: rs.leg, phase: state.race.status,
                            inZone, mDist: Math.round(mDist), mark: String(mName),
                            geom, dh: +dh.toFixed(2), rel: +rel.toFixed(2),
                            spdA: +(a.speed * 60).toFixed(1), spdB: +(b.speed * 60).toFixed(1),
                            overlap: ia ? !!ia.overlap : null,
                            rowSelf: rowOwner == null ? 'none' : (rowOwner === a.id ? 'self' : 'other'),
                            pen: !!(a.raceState.penalty || b.raceState.penalty),
                            legB: b.raceState.leg,
                            // CAUSALITY. A penalty is awarded AT a contact, so
                            // "either boat mid-penalty" is ambiguous by itself:
                            // penaltyFlagTime says whether the penalty PREDATES
                            // this rub, and penaltySpin says whether a boat was
                            // actually turning its 360 when the rub happened.
                            pfA: +((a.raceState.penaltyFlagTime || 0).toFixed(1)),
                            pfB: +((b.raceState.penaltyFlagTime || 0).toFixed(1)),
                            spinA: !!(a.controller && a.controller.penaltySpin),
                            spinB: !!(b.controller && b.controller.penaltySpin),
                            // Rule 21 covers OCS returners as well as penalty
                            // boats — same trap, different trigger.
                            ocsA: !!a.raceState.ocs, ocsB: !!b.raceState.ocs,
                        });
                    }
                }
            } catch (e) {}
            return inner && inner(ty, d);
        };
    });

    const all = [];
    let nLegs = 0, fins = 0, nBoats = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            window.__rub = []; window.__rubT = {};
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 900) break;
            }
            return {
                rub: window.__rub, nLegs: state.course.dmc.legs.length - 1,
                fins: bots.filter(b => b.raceState.finished).length, nBoats: bots.length,
            };
        }, seed);
        all.push(...r.rub.map(x => ({ ...x, seed })));
        nLegs = r.nLegs; fins += r.fins; nBoats += r.nBoats;
        console.log(`seed ${seed}: ${r.rub.length} rub episodes, ${r.fins}/${r.nBoats} finished`);
    }
    await browser.close();

    const tally = (key, rows) => {
        const m = {};
        for (const r of rows) m[r[key]] = (m[r[key]] || 0) + 1;
        return Object.entries(m).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k} ${v} (${(100 * v / rows.length).toFixed(0)}%)`).join(' | ');
    };
    const racing = all.filter(r => r.phase === 'racing');
    const pre = all.filter(r => r.phase !== 'racing');
    console.log(`\nBAY BOAT-RUB ATTRIBUTION (${TRIALS} seeds, ${nBoats} boat-races, ${nLegs} legs)`);
    console.log(`  total ${all.length} episodes = ${(all.length / nBoats).toFixed(2)}/boat-race` +
        `  (human reference 0.14/race)`);
    console.log(`  phase:    racing ${racing.length} | prestart ${pre.length}`);
    if (racing.length) {
        console.log(`  leg:      ${tally('leg', racing)}`);
        console.log(`  geometry: ${tally('geom', racing)}`);
        console.log(`  ROW:      ${tally('rowSelf', racing)}`);
        console.log(`  in zone:  ${tally('inZone', racing)}`);
        console.log(`  overlap:  ${tally('overlap', racing)}`);
        const nearMark = racing.filter(r => r.mDist < 400).length;
        console.log(`  nearest mark <400u: ${nearMark} (${(100 * nearMark / racing.length).toFixed(0)}%)` +
            `   mark: ${tally('mark', racing.filter(r => r.mDist < 400))}`);
        const slow = racing.filter(r => r.spdA < 60).length;
        console.log(`  own speed <1.0 (60u/s): ${slow} (${(100 * slow / racing.length).toFixed(0)}%)`);
        const sameLeg = racing.filter(r => r.leg === r.legB).length;
        console.log(`  same leg as other boat: ${sameLeg} (${(100 * sameLeg / racing.length).toFixed(0)}%)`);
        const penalised = racing.filter(r => r.pen).length;
        console.log(`  either boat mid-penalty: ${penalised} (${(100 * penalised / racing.length).toFixed(0)}%)`);
        const preExisting = racing.filter(r => r.pfA > 2 || r.pfB > 2).length;
        const spinning = racing.filter(r => r.spinA || r.spinB).length;
        const spinFresh = racing.filter(r => (r.spinA || r.spinB) && !(r.pfA > 2 || r.pfB > 2)).length;
        console.log(`  penalty PREDATES rub (>2s outstanding): ${preExisting} (${(100 * preExisting / racing.length).toFixed(0)}%)`);
        console.log(`  a boat was mid-360 SPIRAL at the rub:   ${spinning} (${(100 * spinning / racing.length).toFixed(0)}%)  [of which fresh-penalty ${spinFresh}]`);
        const ocs = racing.filter(r => r.ocsA || r.ocsB).length;
        const r21 = racing.filter(r => r.ocsA || r.ocsB || r.pfA > 2 || r.pfB > 2).length;
        console.log(`  a boat was OCS (returning):             ${ocs} (${(100 * ocs / racing.length).toFixed(0)}%)`);
        console.log(`  RULE 21 EXPOSURE (OCS or flagged):     ${r21} (${(100 * r21 / racing.length).toFixed(0)}%)`);
        const l0 = racing.filter(r => r.leg === 0);
        if (l0.length) {
            const l0ocs = l0.filter(r => r.ocsA || r.ocsB).length;
            const l0pen = l0.filter(r => r.pfA > 2 || r.pfB > 2).length;
            console.log(`  LEG 0 (post-gun, pre-line) n=${l0.length}: OCS ${l0ocs} | flagged ${l0pen} | neither ${l0.length - l0.filter(r => r.ocsA || r.ocsB || r.pfA > 2 || r.pfB > 2).length}`);
        }
    }
    if (pre.length) console.log(`  PRESTART geometry: ${tally('geom', pre)} | ROW: ${tally('rowSelf', pre)}`);
    if (LABEL) {
        fs.writeFileSync(path.join(__dirname, `bay_rub_${LABEL}.json`), JSON.stringify(all));
        console.log(`\nwrote bay_rub_${LABEL}.json`);
    }
})();
