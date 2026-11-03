// Wind events (sim/wind.js windEventsInit / windEventAt): sudden shifts on a seeded schedule.
//
//   node regatta/eval/test_wind_events.js        (NODE_PATH=node_modules, from repo root)
//
// Pins: a step turns in its ramp and holds; a non-persistent one comes back, a persistent one
// stays; a travelling one reaches upwind water first; `eventsFrom` borrows a schedule; the same
// seed rolls the same day and a different seed a different one; the mean field ignores events;
// sampling consumes no shared RNG; the clock is real seconds from the gun, not the world clock;
// vents fire on their pulse.
const { chromium } = require('playwright');
const path = require('path');

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.resolve('regatta/index.html'));

    const r = await page.evaluate(() => {
        const D = Math.PI / 180;
        const box = (cx, cy, half) => ([[cx-half,cy-half],[cx+half,cy-half],[cx+half,cy+half],[cx-half,cy+half]]);
        const mk = (o) => Object.assign({ poly: box(0, 0, 3000), falloff: 0, direction: 0, dirVar: 0, speed: 10, speedVar: 0, period: 0, phase: 0,
            bb: { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 } }, o);
        const saved = { regs: state.course.windRegions, gun: state.wind.gunTime, time: state.time, status: state.race.status };
        const at = (T, x = 0, y = 0) => { state.wind.gunTime = 0; state.time = T * WORLD_CLOCK; return regionWindAt(x, y); };
        const out = {};

        // One step: +12 deg at t=10, 2 s ramp, 5 s hold, not travelling.
        let regs = [mk({ id: 'A', events: { start: 10, count: 1, size: 12, bias: 1, ramp: 2, hold: 5, speed: 2 } })];
        windEventsInit(regs, 1234, []); state.course.windRegions = regs;
        out.before = at(9.9).direction / D;
        out.mid = at(11).direction / D;
        out.held = at(14).direction / D; out.heldKt = at(14).speed;
        out.after = at(20).direction / D;

        // Persistent: stays.
        regs = [mk({ id: 'A', events: { start: 10, count: 1, size: 15, bias: -1, ramp: 2 } })];
        windEventsInit(regs, 1234, []); state.course.windRegions = regs;
        out.pLate = at(300).direction / D;

        // Travelling along a north wind (direction 0 = FROM the north, so it blows toward +y):
        // the event reaches y = -2000 (upwind) before y = +2000.
        regs = [mk({ id: 'A', events: { start: 30, count: 1, size: 20, bias: 1, ramp: 1, travel: 100 } })];
        windEventsInit(regs, 1234, [{ x: 0, y: 0 }]); state.course.windRegions = regs;
        out.upAt15 = at(15, 0, -2000).direction / D;      // delay -20 s: arrived at 10 s
        out.downAt15 = at(15, 0, 2000).direction / D;     // delay +20 s: arrives at 50 s
        out.centreAt29 = at(29, 0, 0).direction / D; out.centreAt32 = at(32, 0, 0).direction / D;

        // eventsFrom: B feels A's schedule.
        regs = [mk({ id: 'A', events: { start: 5, count: 1, size: 10, bias: 1, ramp: 1 } }), mk({ id: 'B', eventsFrom: 'A', poly: box(9000, 0, 500), bb: { minX: 8500, minY: -500, maxX: 9500, maxY: 500 } })];
        windEventsInit(regs, 1234, []); state.course.windRegions = regs;
        out.borrowed = at(10, 9000, 0).direction / D;

        // Seeds: same seed same schedule, different seed different.
        const roll = (seed) => { const g = [mk({ id: 'A', events: { every: [10, 30], size: [5, 20], ramp: [1, 3], hold: [5, 10] } })]; windEventsInit(g, seed, []); return JSON.stringify(g[0]._evOwn[0].evs); };
        out.same = roll(77) === roll(77); out.diff = roll(77) !== roll(78);

        // One-way day: a trend plus surges, all the same way, capped at max.
        regs = [mk({ id: 'A', events: { oneWay: true, bias: 1, trend: 6, every: 20, size: 5, ramp: 1, max: 20 } })];
        windEventsInit(regs, 1234, []); state.course.windRegions = regs;
        out.ow30 = at(30).direction / D; out.ow300 = at(300).direction / D;
        out.owSigns = regs[0]._evOwn[0].evs.every(e => e.d > 0);
        // `from`: an event arriving from the east (90) reaches x = +2000 before x = -2000.
        regs = [mk({ id: 'A', events: { start: 30, count: 1, size: 20, bias: 1, ramp: 1, travel: 100, from: 90 } })];
        windEventsInit(regs, 1234, [{ x: 0, y: 0 }]); state.course.windRegions = regs;
        out.eastAt15 = at(15, 2000, 0).direction / D; out.westAt15 = at(15, -2000, 0).direction / D;
        // eventsScale: a borrower feels a fraction.
        regs = [mk({ id: 'A', events: { start: 5, count: 1, size: 10, bias: 1, ramp: 1 } }), mk({ id: 'B', eventsFrom: 'A', eventsScale: 0.6, poly: box(9000, 0, 500), bb: { minX: 8500, minY: -500, maxX: 9500, maxY: 500 } })];
        windEventsInit(regs, 1234, []); state.course.windRegions = regs;
        out.scaled = at(10, 9000, 0).direction / D;

        // Mean field ignores them; sampling draws nothing from the shared stream.
        regs = [mk({ id: 'A', events: { start: 0, count: 1, size: 20, bias: 1, ramp: 1 } })];
        windEventsInit(regs, 1234, []); state.course.windRegions = regs;
        WIND_MEAN_FIELD = true; out.meanDir = at(50).direction / D; WIND_MEAN_FIELD = false;
        const r0 = Math.random; let draws = 0; Math.random = () => { draws++; return r0(); };
        for (let i = 0; i < 50; i++) at(i);
        Math.random = r0; out.draws = draws;

        // VENTS on a pulse: births only at the vents, on the seeded rhythm, and none before their time.
        const vreg = { id: 'V', poly: box(0, 0, 500), bb: { minX: -500, minY: -500, maxX: 500, maxY: 500 }, falloff: 100, count: 9, gustKt: 6, sizeM: 100, lifeS: 30, bias: 1, veer: 0,
            vents: [[100, 0], [-200, 50]], pulse: { every: [10, 20] }, tell: 3 };
        const savedG = { regs: state.course.gustRegions, gusts: state.gusts };
        state.course.gustRegions = [vreg]; state.gusts = [];
        gustVentsInit([vreg], 99);
        const sch1 = JSON.stringify(vreg._pulse.map(v => v.times)); gustVentsInit([vreg], 99);
        out.ventSame = sch1 === JSON.stringify(vreg._pulse.map(v => v.times));
        const firstFire = Math.min(...vreg._pulse.map(v => v.times.find(t => t > 0)));
        state.wind.gunTime = 0; state.time = 0; updateGustVents([vreg]);
        const born0 = state.gusts.length;
        // walk the clock to 60 s in small steps
        for (let t = 0; t <= 60; t += 0.25) { state.time = t * WORLD_CLOCK; updateGustVents([vreg]); }
        out.ventBirths = state.gusts.length - born0;
        out.ventAtVents = state.gusts.every(g => vreg.vents.some(v => g.x === v[0] && g.y === v[1]) && g.pulsed && g.src === 'V');
        const expect = vreg._pulse.reduce((a, v) => a + v.times.filter(t => t > 0 && t <= 60).length, 0);
        out.ventExpect = expect;
        out.firstFire = firstFire;
        state.course.gustRegions = savedG.regs; state.gusts = savedG.gusts;

        // Prestart clock: before the gun the schedule counts from minus the start timer.
        state.wind.gunTime = null; state.race.status = 'prestart'; state.race.timer = 12;
        out.preClock = windRaceClock();

        state.course.windRegions = saved.regs; state.wind.gunTime = saved.gun; state.time = saved.time; state.race.status = saved.status;
        return out;
    });

    const near = (a, b, t) => Math.abs(a - b) <= t;
    check('nothing before the event', near(r.before, 0, 0.01), r.before);
    check('mid-ramp it is part-way', r.mid > 1 && r.mid < 11, r.mid);
    check('held at the full step', near(r.held, 12, 0.01), r.held);
    check('with the pressure it brought', near(r.heldKt, 12, 0.01), r.heldKt);
    check('a non-persistent step comes back', near(r.after, 0, 0.01), r.after);
    check('a persistent step stays', near(r.pLate, -15, 0.01), r.pLate);
    check('a travelling step reaches upwind water first', near(r.upAt15, 20, 0.01) && near(r.downAt15, 0, 0.01), `${r.upAt15} / ${r.downAt15}`);
    check("its `t` is when it reaches the course centre", near(r.centreAt29, 0, 0.01) && r.centreAt32 > 19, `${r.centreAt29} / ${r.centreAt32}`);
    check('eventsFrom borrows the schedule', near(r.borrowed, 10, 0.01), r.borrowed);
    check('a one-way day drifts with its trend', r.ow30 > 2.9, r.ow30);
    check('...and stops at its max', Math.abs(r.ow300 - 20) < 0.01, r.ow300);
    check('...with every surge the same way', r.owSigns);
    check('`from` sets which side gets it first', Math.abs(r.eastAt15 - 20) < 0.01 && Math.abs(r.westAt15) < 0.01, `${r.eastAt15} / ${r.westAt15}`);
    check('eventsScale feels a fraction', Math.abs(r.scaled - 6) < 0.01, r.scaled);
    check('same seed, same day', r.same);
    check('different seed, different day', r.diff);
    check('the mean field leaves events out', near(r.meanDir, 0, 0.01), r.meanDir);
    check('sampling consumes no rng draws', r.draws === 0, r.draws);
    check('prestart clock counts down to the gun', near(r.preClock, -12, 1e-9), r.preClock);
    check('vent pulses are seeded', r.ventSame);
    check('a vent fires on each of its times, and only from the vents', r.ventBirths === r.ventExpect && r.ventBirths >= 4 && r.ventAtVents, `${r.ventBirths} of ${r.ventExpect}, at vents ${r.ventAtVents}`);
    check('no page errors', errs.length === 0, errs.join('; '));
    await browser.close();
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
