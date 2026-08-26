// TEN-BOT ERA side-thread (2026-08-26, measurement ONLY — arctic builds are
// owner-reserved): WHERE does the tenth hull cost arctic? Boat-contact
// events on a tbarc bench replayed by sequence, classified by location:
// at-ice (nearest floe <150u), mark-zone (dist to leg mark < zone*1.5),
// prestart/leg0, else open. Speed at contact. Sizes the substrate decision.
//   node _tb_arctax.js <tree> <seed0> <nraces>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const SEED0 = parseInt(process.argv[3] || '9100');
const NRACES = parseInt(process.argv[4] || '6');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
    }, 'arctic');
    const agg = { atIce: 0, markZone: 0, leg0: 0, open: 0, kts: [], n: 0 };
    for (let race = 0; race < NRACES; race++) {
        const seed = SEED0 + race;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            if (pl) {
                applyBoatIdentity(pl, playerCharacter(), false);
                pl.isPlayer = false; pl.manualTrim = false;
                const nine = state.boats.filter(b => b !== pl);
                pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                    nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
                pl.ai.setupDist = 300;
            }
            const EV = [];
            {
                const inner = window.onRaceEvent;
                const lastT = {};
                window.onRaceEvent = (ty, d) => {
                    try {
                        if (ty === 'collision_boat' && d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished) {
                            const t = state.race.timer;
                            const k = d.boat.name;
                            if (lastT[k] == null || t - lastT[k] >= 2.0) {   // episodes, 2s debounce
                                lastT[k] = t;
                                const b = d.boat;
                                let fd = Infinity;
                                for (const fo of (state.course._floeObjs || [])) {
                                    const dd = Math.hypot(fo.x - b.x, fo.y - b.y) - (fo.radius || 0);
                                    if (dd < fd) fd = dd;
                                }
                                const rm = (window.legRoundMark ? legRoundMark(b.raceState.leg) : null) || state.course.roundMark;
                                const inZone = rm && Math.hypot(b.x - rm.x, b.y - rm.y) < (rm.zone || 165) * 1.5;
                                EV.push({ leg: b.raceState.leg, floeD: Math.round(fd), zone: inZone ? 1 : 0, kt: +(b.speed * 4).toFixed(1) });
                            } else lastT[k] = t;
                        }
                    } catch (e) {}
                    return inner && inner(ty, d);
                };
            }
            const DT = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                update(DT); it++;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
            }
            return EV;
        }, seed);
        for (const e of r) {
            agg.n++;
            if (e.leg < 1) agg.leg0++;
            else if (e.floeD < 150) agg.atIce++;
            else if (e.zone) agg.markZone++;
            else agg.open++;
            agg.kts.push(e.kt);
        }
        console.log(`race ${race} (seed ${seed}): boat-contact episodes ${r.length}`);
    }
    agg.kts.sort((a, b) => a - b);
    console.log(`tree ${TREE} arctic ${SEED0}x${NRACES}: episodes ${agg.n} — leg0/start ${agg.leg0} (${(100*agg.leg0/agg.n).toFixed(0)}%), AT-ICE ${agg.atIce} (${(100*agg.atIce/agg.n).toFixed(0)}%), mark-zone ${agg.markZone} (${(100*agg.markZone/agg.n).toFixed(0)}%), open ${agg.open} (${(100*agg.open/agg.n).toFixed(0)}%); kt med ${agg.kts[agg.kts.length>>1]}`);
    await browser.close();
})();
