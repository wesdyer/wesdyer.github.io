// WHO OWNS THE RING TIME? (2026-08-24 night, rounding-craft push, P1.3)
// _roundcraft.js priced the ring: redrock +36.7 s/lap vs him (leg2 +15.5),
// lake +7.8 all at leg 2, lagoon +14.2, bay +8.3. This decomposes the fleet's
// ring frames (d < 1.5*zone, from window open until 2z receding after advance)
// by what is steering/limiting the boat, per (venue, leg):
//   spin       rs.penalty (penalty turn/flag active)
//   stuck      speed*60 < 15 (aground/wedged; rule 28's collapsed state)
//   wiggle     controller.wiggleActive
//   av-rival   applyAvoidance deviated >20 deg with a rival within 200u
//   av-solo    applyAvoidance deviated >20 deg, no rival within 200u
//              (= obstacle/land dodge inside the ring)
//   nav        none of the above (following orbit/exit targets cleanly)
// plus rivalNear share and mean speed per tag. Frames here, but reported as
// SECONDS PER LAP alongside the episode census — the denominators are the
// census's own episodes.
//   node _ring_own.js <venue> <trials> <seed0> <tree> [legs=2,3]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9400;
const TREE = process.argv[5] || 'treeN1';
const LEGS = (process.argv[6] || '').startsWith('legs=') ? process.argv[6].slice(5).split(',').map(Number) : null;
const ROOT = path.join(__dirname, TREE);

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const ACC = {};
    for (let t = 0; t < TRIALS; t++) {
        const seed = SEED0 + t;
        const r = await p.evaluate(({ seed, LEGS }) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const rounds = [];
            const route = state.course.route || [];
            for (let i = 0; i < route.length; i++) {
                const e = route[i];
                if (e && e.kind === 'round' && e.mark && (!LEGS || LEGS.includes(i)))
                    rounds.push({ leg: i, x: e.mark.x, y: e.mark.y, zone: e.mark.zone });
            }
            const wrapAll = () => {
                for (const bo of state.boats) {
                    if (bo.isPlayer) continue;
                    const c = bo.controller;
                    if (!c || !c.applyAvoidance || c.__rwrapped) continue;
                    const orig = c.applyAvoidance.bind(c);
                    c.applyAvoidance = (dh, sr) => { const out = orig(dh, sr); bo._avDev = Math.abs(norm(out - dh)); return out; };
                    c.__rwrapped = 1;
                }
            };
            const DT = 1 / 60;
            const acc = {}; // leg -> tag -> seconds ; plus counts
            const boatsN = state.boats.filter(x => !x.isPlayer).length;
            for (let it = 0; it < 60 * 900; it++) {
                for (const bo of state.boats) bo._avDev = 0;
                wrapAll();
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const bs = state.boats.filter(x => !x.isPlayer && !x.raceState.finished);
                for (const bo of bs) {
                    const rs = bo.raceState;
                    for (const rm of rounds) {
                        if (rs.leg !== rm.leg && rs.leg !== rm.leg + 1) continue;
                        const d = Math.hypot(bo.x - rm.x, bo.y - rm.y);
                        if (d > rm.zone * 1.5) continue;
                        const A = acc[rm.leg] || (acc[rm.leg] = { spin: 0, stuck: 0, wiggle: 0, avRival: 0, avSolo: 0, nav: 0, tot: 0, rivalNear: 0, spSum: 0 });
                        let rival = false;
                        for (const ob of bs) {
                            if (ob === bo) continue;
                            if (Math.hypot(ob.x - bo.x, ob.y - bo.y) < 200) { rival = true; break; }
                        }
                        const c = bo.controller || {};
                        const sp = (bo.speed || 0) * 60;
                        let tag;
                        if (rs.penalty) tag = 'spin';
                        else if (sp < 15) tag = 'stuck';
                        else if (c.wiggleActive) tag = 'wiggle';
                        else if ((bo._avDev || 0) > 0.35) tag = rival ? 'avRival' : 'avSolo';
                        else tag = 'nav';
                        A[tag] += DT; A.tot += DT;
                        if (rival) A.rivalNear += DT;
                        A.spSum += sp * DT;
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return { acc, boatsN };
        }, { seed, LEGS });
        for (const [leg, A] of Object.entries(r.acc)) {
            const T = ACC[leg] || (ACC[leg] = { spin: 0, stuck: 0, wiggle: 0, avRival: 0, avSolo: 0, nav: 0, tot: 0, rivalNear: 0, spSum: 0, laps: 0 });
            for (const k of ['spin', 'stuck', 'wiggle', 'avRival', 'avSolo', 'nav', 'tot', 'rivalNear', 'spSum']) T[k] += A[k];
            T.laps += r.boatsN;
        }
        console.log(`seed ${seed} done`);
    }
    await b.close();
    console.log(`\n=== ${VENUE.toUpperCase()} RING OWNERSHIP (per boat-lap seconds inside 1.5*zone) ===`);
    for (const [leg, T] of Object.entries(ACC)) {
        const f = (x) => (x / T.laps).toFixed(1);
        console.log(`LEG ${leg}: total ${f(T.tot)}s/lap  | spin ${f(T.spin)}  stuck ${f(T.stuck)}  wiggle ${f(T.wiggle)}  av-rival ${f(T.avRival)}  av-solo ${f(T.avSolo)}  nav ${f(T.nav)}  | rival<200u ${(100 * T.rivalNear / T.tot).toFixed(0)}%  mean speed ${(T.spSum / T.tot).toFixed(0)} u/s`);
    }
})();
