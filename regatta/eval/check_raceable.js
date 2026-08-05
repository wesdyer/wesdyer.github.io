// CAN THE FLEET ACTUALLY RACE THIS COURSE? — the gate `test_sailable` is not.
//
//   node regatta/eval/check_raceable.js [venue] [races]
//
// `test_sailable` drives ONE boat along a correct path and asks whether the system
// recognises it. That is a necessary check and not a sufficient one: Redrock passes it and
// then produces ONE finisher in seventy-two boat-races, because 4015 navigable cells is an
// order of magnitude less water than any venue the fleet has ever sailed and the boats
// simply grind into the rock.
//
// So this races the real fleet, briefly, and reports the three numbers that tell an author
// whether the course they just drew is sailable BY BOATS rather than by an ideal path:
//
//   finishers within the venue's OWN authored cutoff
//   land collisions per boat-race
//   the leg the fleet dies on
//
// Deliberately NOT in `npm test`: a race is half a minute of wall clock and the suite is
// meant to be fast. Run it when a venue is authored or its land is edited.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ONLY = process.argv[2] || null;
const RACES = +(process.argv[3] || 2);

// A course the fleet cannot finish is not a course. These are deliberately loose — they
// are looking for a venue that is broken, not for a venue that is hard.
const MIN_FINISH_FRAC = 0.5;      // half the fleet, inside the authored cutoff
const MAX_LAND_PER_RACE = 40;     // arctic's ice-strewn 25-33 is the honest ceiling

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
    await page.waitForTimeout(400);
    const venues = await page.evaluate(() => Object.keys(window.VENUE_DOC || {}));
    const list = ONLY ? [ONLY] : venues;
    console.log(`Raceability — ${list.length} venue(s), ${RACES} race(s) each\n`);

    for (const venue of list) {
        const acc = { fin: 0, inTime: 0, n: 0, land: 0, boat: 0, pen: 0, cutoff: 0, deep: {} };
        for (let i = 0; i < RACES; i++) {
            const r = await page.evaluate(async ([v, seed]) => {
                localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
                window.evalHarness.seed = seed;
                window.resetGame(); window.startRace();
                const cutoff = state.course.cutoff || 360;
                const cc = {};
                const inner = window.onRaceEvent;
                window.onRaceEvent = (ty, d) => {
                    try {
                        if (d && d.boat && !d.boat.isPlayer &&
                            (ty === 'collision_island' || ty === 'collision_boat')) {
                            const k = ty === 'collision_boat' ? 'boat' : 'land';
                            cc[k] = (cc[k] || 0) + 1;
                        }
                    } catch (e) {}
                    return inner && inner(ty, d);
                };
                // Generous headroom over the authored cutoff, so "slow" and "stuck" are
                // told apart rather than both reading as a DNF.
                state.course.cutoff = Math.max(900, cutoff * 2.5);
                const bots = state.boats.filter(b => !b.isPlayer);
                const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
                const fin = bots.map(() => null), deepest = bots.map(() => 0);
                const dt = 1 / 60;
                for (let it = 0; it < 60 * 940; it++) {
                    window.update(dt);
                    if (state.race.status === 'finished') break;
                    if (state.race.status !== 'racing') continue;
                    if (state.race.timer > state.course.cutoff) break;
                    for (let k = 0; k < bots.length; k++) {
                        if (bots[k].raceState.leg > deepest[k]) deepest[k] = bots[k].raceState.leg;
                        if (fin[k] == null && bots[k].raceState.finished) fin[k] = Math.round(state.race.timer);
                    }
                    if (fin.every(f => f != null)) break;
                }
                return { cutoff, n: bots.length, fin, deepest, cc,
                         pen: bots.reduce((a, b) => a + (b.raceState.totalPenalties || 0), 0) };
            }, [venue, 9100 + i]);
            acc.cutoff = r.cutoff; acc.n += r.n;
            acc.fin += r.fin.filter(x => x != null).length;
            acc.inTime += r.fin.filter(x => x != null && x <= r.cutoff).length;
            acc.land += (r.cc.land || 0); acc.boat += (r.cc.boat || 0); acc.pen += r.pen;
            for (const d of r.deepest) acc.deep[d] = (acc.deep[d] || 0) + 1;
        }
        const per = (x) => (x / acc.n).toFixed(1);
        console.log(`${venue}  (authored cutoff ${acc.cutoff}s)`);
        check(`at least half the fleet finishes inside the cutoff`,
              acc.inTime >= acc.n * MIN_FINISH_FRAC,
              `${acc.inTime}/${acc.n} inside ${acc.cutoff}s (${acc.fin}/${acc.n} ever finished)`);
        check(`the fleet is not grinding into the land`,
              acc.land / acc.n <= MAX_LAND_PER_RACE,
              `${per(acc.land)} land collisions per boat-race`);
        console.log(`         ${per(acc.boat)} boat rubs, ${per(acc.pen)} penalties per boat-race`);
        console.log(`         furthest leg reached: ${JSON.stringify(acc.deep)}\n`);
    }
    await browser.close();
    if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
    console.log(`${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
