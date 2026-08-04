// Gust regions: the ONLY source of puffs.
//
//   node regatta/eval/test_gusts.js
//
// A gust and a lull are one thing: an ellipse carrying a signed speedDelta, drifting downwind
// and steering by the local breeze. Where they come from used to be a venue-wide variable —
// `puffiness` scattered `5 + puffiness * 20` cells uniformly over the arena, and no course
// could say anything about it.
//
// That was the same mistake the base wind was. Gusts are now stated by GUST REGIONS exactly
// as the wind is stated by wind regions: a source carries its own count, size, gust/lull
// split and veer, and **no source means no puffs**, the same way no wind region means calm.
//
// THE PROPERTY THAT MATTERS MOST is that last one. A course with no gust regions has a steady
// breeze — a legitimate course, and the one every venue has until someone draws a source.
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
        const o = {};
        const real = Math.random;
        const seeded = (seed) => { let s = seed; return () => {
            let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
        const box = (cx, cy, half) => ([[cx-half,cy-half],[cx+half,cy-half],[cx+half,cy+half],[cx-half,cy+half]]);
        const d = window.VenueDoc.get('seatrials');
        const race = (regions, seed) => {
            if (regions) d.gusts = { regions }; else delete d.gusts;
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
            Math.random = seeded(seed == null ? 4242 : seed);
            resetGame();
        };

        // ── 1. NO SOURCE, NO PUFFS ──────────────────────────────────────────
        // The headline property. There is no venue-wide puffiness behind the regions and no
        // uniform scatter beside them, so a course that authors nothing has steady wind.
        race(null);
        o.noneAtRest = state.gusts.length;
        for (let i = 0; i < 600; i++) updateGusts(1 / 60);
        o.noneAfterRunning = state.gusts.length;
        // ...and the wind really is steady: same point, same answer, minutes apart.
        const b = state.course.boundary;
        const w0 = getWindAt(b.x, b.y).speed;
        state.time = 300;
        for (let i = 0; i < 600; i++) updateGusts(1 / 60);
        o.steady = Math.abs(getWindAt(b.x, b.y).speed - w0) < 1e-9;

        // ── 2. A SOURCE STATES ITS OWN POPULATION ───────────────────────────
        const half = b.radius * 0.25, cx = b.x - b.radius * 0.4, cy = b.y;
        race([{ id: 'west', poly: box(cx, cy, half), falloff: 200, count: 6 }]);
        o.bornAtReset = state.gusts.length;
        // Checked AT BIRTH. A cell then drifts downwind and leaves its source, which is the
        // whole point of authoring where puffs come FROM — testing them after a few hundred
        // frames would be asserting that they never travel.
        const inBox = (g) => Math.abs(g.x - cx) <= half + 1 && Math.abs(g.y - cy) <= half + 1;
        o.allInside = state.gusts.length > 0 && state.gusts.every(inBox);
        // Where each cell started, so its travel can be measured rather than inferred from
        // whether it happens to have cleared a box of a particular size.
        const born = state.gusts.map(g => ({ id: g, x: g.x, y: g.y }));
        for (let i = 0; i < 300; i++) updateGusts(1 / 60);
        o.holdsCount = state.gusts.length;
        // DOWNWIND travel: wind direction is where it comes FROM, so it blows toward
        // (-sin, +cos). Every surviving cell should have moved that way.
        const wdir = state.wind.direction;
        const dux = -Math.sin(wdir), duy = Math.cos(wdir);
        const moved = born.filter(p => state.gusts.includes(p.id))
                          .map(p => (p.id.x - p.x) * dux + (p.id.y - p.y) * duy);
        o.theyTravel = moved.length > 0 && moved.every(m => m > 50);
        o.travelMin = moved.length ? +Math.min(...moved).toFixed(0) : 0;

        // TWO sources, each converging on ITS OWN number rather than sharing a pool. This is
        // the difference between an absolute count and the weight it replaced.
        const ex = b.x + b.radius * 0.4;
        race([{ id: 'w', poly: box(cx, cy, half), falloff: 200, count: 9 },
              { id: 'e', poly: box(ex, cy, half), falloff: 200, count: 3 }]);
        for (let i = 0; i < 600; i++) updateGusts(1 / 60);
        o.perSource = { w: state.gusts.filter(g => g.src === 'w').length,
                        e: state.gusts.filter(g => g.src === 'e').length };
        o.total = state.gusts.length;

        // A source at count 0 is switched off without deleting the polygon you drew.
        race([{ id: 'w', poly: box(cx, cy, half), falloff: 200, count: 0 },
              { id: 'e', poly: box(ex, cy, half), falloff: 200, count: 4 }]);
        for (let i = 0; i < 300; i++) updateGusts(1 / 60);
        o.zeroSilent = state.gusts.every(g => g.src === 'e') && state.gusts.length === 4;

        // ── 2b. A PUFF IS STEERED BY THE BREEZE IT IS IN ────────────────────
        // Two wind regions 90 degrees apart, and a source sitting squarely in the second.
        // Its cells must set off along the wind THERE, not along the venue's representative
        // wind — which is what they used to do, so a source drawn in a katabatic tongue
        // emitted puffs that crossed it and left. Glacier Sound measured 3 cells alive and
        // 0.04 of them inside the arena before this.
        const wsave = JSON.parse(JSON.stringify(d.wind));
        const RR = b.radius;
        d.wind = { regions: [
            { id: 'w-main', poly: box(b.x, b.y, RR * 0.95), falloff: 150, direction: 0, speed: 12 },
            { id: 'w-corner', poly: box(b.x + RR * 0.45, b.y, RR * 0.3), falloff: 60, direction: Math.PI / 2, speed: 12 }
        ] };
        race([{ id: 'corner', poly: box(b.x + RR * 0.45, b.y, RR * 0.12), falloff: 100, count: 6 }], 777);
        const localDir = regionWindAt(b.x + RR * 0.45, b.y).direction;
        const globalDir = state.wind.direction;
        o.dirsDiffer = Math.abs(((localDir - globalDir + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.6;
        const start = state.gusts.map(g => ({ g, x: g.x, y: g.y }));
        for (let i = 0; i < 240; i++) updateGusts(1 / 60);
        // WHICH WIND DID IT ACTUALLY FOLLOW? Compare the bearing the cells travelled on to
        // the two candidate winds and take the nearer. Threshold-free, and it states the
        // claim exactly. (A component test is wrong here: the two winds are 90 degrees apart
        // but the regions overlap, so a cell correctly BENDS toward the main wind as it
        // leaves the corner and picks up a real component along both.)
        const live = start.filter(p => state.gusts.includes(p.g));
        const mdx = live.reduce((a, p) => a + (p.g.x - p.x), 0) / (live.length || 1);
        const mdy = live.reduce((a, p) => a + (p.g.y - p.y), 0) / (live.length || 1);
        const travelFrom = Math.atan2(-mdx, mdy);          // the wind such cells came FROM
        const angOff = (a, bb) => Math.abs(((a - bb + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 180 / Math.PI;
        o.offLocal = +angOff(travelFrom, localDir).toFixed(1);
        o.offGlobal = +angOff(travelFrom, globalDir).toFixed(1);
        o.travelled = +Math.hypot(mdx, mdy).toFixed(0);
        o.steeredLocally = live.length > 0 && o.travelled > 50 && o.offLocal < o.offGlobal;
        // ...and a cell lies ACROSS the breeze it is in, so it re-aims as it crosses a bend.
        o.rotatesLocally = state.gusts.every(g => {
            const w = regionWindAt(g.x, g.y);
            const want = w.direction + g.dirDelta + Math.PI / 2;
            return Math.abs(((g.rotation - want + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1e-9;
        });
        d.wind = wsave;

        // ── 3. CHARACTER IS THE SOURCE'S, NOT THE VENUE'S ───────────────────
        const shapeOf = (extra) => {
            race([Object.assign({ id: 'x', poly: box(cx, cy, half), falloff: 200, count: 1 }, extra)], 5150);
            const g = state.gusts[0];
            return { rx: +g.maxRadiusX.toFixed(4), dur: +g.duration.toFixed(4),
                     sd: +Math.abs(g.speedDelta).toFixed(4), veer: +Math.abs(g.dirDelta).toFixed(5) };
        };
        const base = shapeOf({});
        // The three are stated in KNOTS, METRES and SECONDS now, so each is checked against
        // the quantity it names rather than against a multiple of an unstated base.
        o.gustIsKnots   = Math.abs(shapeOf({ gustKt: 12 }).sd - base.sd * (12 / 5)) < 1e-3;   // default 5 kt
        o.sizeIsMetres  = Math.abs(shapeOf({ sizeM: 600 }).rx - base.rx * 2) < 1e-3;          // default 300 m
        o.lifeIsSeconds = Math.abs(shapeOf({ lifeS: 180 }).dur - base.dur * 2) < 1e-3;        // default 90 s
        // The stated number is the MEAN of what comes out, which is what makes it checkable
        // against the course. Sampled across many births rather than asserted on one.
        race([{ id: 'm', poly: box(cx, cy, half), falloff: 200, count: 60, bias: 1, gustKt: 10, sizeM: 400, lifeS: 120 }]);
        const many = state.gusts;
        const mean = (f) => many.reduce((a, g) => a + f(g), 0) / many.length;
        o.meanKt    = +mean(g => Math.abs(g.speedDelta)).toFixed(2);
        o.meanSizeM = +(mean(g => g.maxRadiusX) * 2 / 5).toFixed(0);
        o.meanLifeS = +mean(g => g.duration).toFixed(0);
        o.meansAreStated = Math.abs(o.meanKt - 10) < 1.2 && Math.abs(o.meanSizeM - 400) < 60 && Math.abs(o.meanLifeS - 120) < 15;
        // A hole is the shallower half of the same signal.
        race([{ id: 'l', poly: box(cx, cy, half), falloff: 200, count: 60, bias: 0, gustKt: 10 }]);
        o.meanLullKt = +(state.gusts.reduce((a, g) => a + Math.abs(g.speedDelta), 0) / state.gusts.length).toFixed(2);
        o.lullIsShallower = o.meanLullKt < o.meanKt && o.meanLullKt > 5;
        // Veer is the SOURCE's now — it was the venue's `puffShiftiness` mapped onto 8-22°.
        const v30 = shapeOf({ veer: 30 });
        o.veerIsPerSource = v30.veer > base.veer * 1.5;
        o.veerPair = `${(base.veer * 180 / Math.PI).toFixed(1)} -> ${(v30.veer * 180 / Math.PI).toFixed(1)} deg`;

        // ── 4. BIAS: A FUNNEL OR A DEAD SPOT ────────────────────────────────
        const typesFor = (bias) => {
            race([{ id: 'x', poly: box(cx, cy, half), falloff: 200, count: 20,
                    ...(bias == null ? {} : { bias }) }]);
            return state.gusts.filter(g => g.type === 'gust').length;
        };
        o.allGust = typesFor(1);
        o.allLull = typesFor(0);
        // No venue split to defer to any more, so an unstated bias is an even mix.
        const mixed = typesFor(null);
        o.defaultMixed = mixed > 3 && mixed < 17;
        o.defaultCount = mixed;

        // ── 5. THE PUFFS ARE REAL WIND ──────────────────────────────────────
        race([{ id: 'w', poly: box(cx, cy, half), falloff: 200, count: 8, bias: 1, gustKt: 10 }]);
        updateGusts(1 / 60);
        const cell = state.gusts.find(g => g.age > 10 && g.age < g.duration - 10 && g.radiusX > 100);
        if (cell) {
            const hot = getWindAt(cell.x, cell.y).speed;
            const saved = state.gusts; state.gusts = [];
            const calm = getWindAt(cell.x, cell.y).speed;
            state.gusts = saved;
            o.puffLifts = hot > calm + 0.5;
            o.puffDelta = +(hot - calm).toFixed(2);
        }

        // ── 6. THE SHAPE OF A PUFF ──────────────────────────────────────────
        // One cell, placed by hand, sampled around it.
        race(null);
        const R = 800;
        const put = (delta) => {
            state.gusts = [{
                type: delta > 0 ? 'gust' : 'lull', x: b.x, y: b.y, vx: 0, vy: 0,
                moveSpeedFactor: 0, moveDirOffset: 0,
                maxRadiusX: R, maxRadiusY: R / 2, radiusX: R, radiusY: R / 2,
                rotation: state.wind.direction + Math.PI / 2,
                speedDelta: delta, dirDelta: 0, duration: 200, age: 100, src: 'x'
            }];
        };
        const spd = (x, y) => getWindAt(x, y).speed;
        const dirAt = (x, y) => getWindAt(x, y).direction;
        const calmAt = (x, y) => { const s = state.gusts; state.gusts = []; const w = getWindAt(x, y); state.gusts = s; return w; };
        put(4);
        const bw = calmAt(b.x, b.y);
        const wd = state.wind.direction;
        const ax = -Math.sin(wd), ay = Math.cos(wd);        // downwind
        const cxu = Math.cos(wd), cyu = Math.sin(wd);       // across
        const boostAt = (f) => spd(b.x + cxu * (R / 2) * f, b.y + cyu * (R / 2) * f) - bw.speed;
        const b0 = boostAt(0);
        o.rimRatio = +(boostAt(0.75) / b0).toFixed(3);
        o.midRatio = +(boostAt(0.5) / b0).toFixed(3);
        const at = 0.8 * R;
        o.tailReaches = spd(b.x - ax * at, b.y - ay * at) - bw.speed > 0.05;
        o.noseIsShorter = Math.abs(spd(b.x + ax * at, b.y + ay * at) - bw.speed) < 1e-6;
        const off = (R / 2) * 0.6;
        const angDiff = (a2, a1) => ((a2 - a1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const dPlus  = angDiff(dirAt(b.x + cxu * off, b.y + cyu * off), bw.direction);
        const dMinus = angDiff(dirAt(b.x - cxu * off, b.y - cyu * off), bw.direction);
        o.fanSplits = Math.sign(dPlus) !== Math.sign(dMinus) && Math.abs(dPlus) > 0.02;
        o.fanDeg = `${(dPlus * 180 / Math.PI).toFixed(1)} / ${(dMinus * 180 / Math.PI).toFixed(1)}`;
        o.axisNoFan = Math.abs(angDiff(dirAt(b.x, b.y), bw.direction)) < 0.01;
        put(-4);
        const lPlus = angDiff(dirAt(b.x + cxu * off, b.y + cyu * off), bw.direction);
        o.lullConverges = Math.sign(lPlus) !== Math.sign(dPlus) && Math.abs(lPlus) > 0.02;

        // ── 7. THE VENUE HAS NO SAY LEFT ────────────────────────────────────
        // Not "no gust variables" — no WEATHER variables at all. Wind, gusts and current
        // are each stated by their own regions, so a venue document has no `conditions`
        // block and the game has no table to roll one from.
        o.noCondTable = !window.VenueDoc.COND;
        o.noCondOnDocs = Object.keys(window.VENUE_DOC).every(k => !(window.VenueDoc.get(k) || {}).conditions);

        delete d.gusts;
        state.gusts = [];
        Math.random = real;
        return o;
    });

    console.log('gust regions: the only source of puffs\n');
    check('no page errors', errs.length === 0, errs.join(' | '));

    // ⚠️ THE HEADLINE. No source, no puffs — the same rule as no wind region, no wind.
    check('a course with no gust source has NO puffs, at rest or running',
          r.noneAtRest === 0 && r.noneAfterRunning === 0, `${r.noneAtRest} / ${r.noneAfterRunning}`);
    check('...and its wind really is steady, minutes apart', r.steady === true);

    check('a source births its own stated count', r.bornAtReset === 6, String(r.bornAtReset));
    check('...and holds it as cells live and die', r.holdsCount === 6, String(r.holdsCount));
    check('every puff is born inside the source that made it', r.allInside === true);
    check('...and then travels DOWNWIND from it, which is why only the source is authored',
          r.theyTravel === true, `least travel ${r.travelMin} units`);
    // An absolute count, not a share: 9 and 3 means 9 and 3, not 12 split 3:1.
    check('two sources each converge on their OWN number, not a shared pool',
          r.perSource.w === 9 && r.perSource.e === 3 && r.total === 12,
          `w ${r.perSource.w}, e ${r.perSource.e}, total ${r.total}`);
    check('a source at count 0 is off without being deleted', r.zeroSilent === true);

    check('a source in a bend emits puffs along the breeze THERE, not the venue average',
          r.steeredLocally === true,
          `travelled ${r.travelled}u, ${r.offLocal} deg off the LOCAL wind vs ${r.offGlobal} deg off the venue average`);
    check('...and the two winds really do differ, so the test can tell them apart', r.dirsDiffer === true);
    check('...and a cell lies across the breeze it is in, re-aiming as it crosses', r.rotatesLocally === true);

    check('gust is stated in KNOTS on the anemometer', r.gustIsKnots === true);
    check('size is stated in METRES across the long axis', r.sizeIsMetres === true);
    check('life is stated in SECONDS', r.lifeIsSeconds === true);
    check('...and each stated number is the MEAN of what the source emits',
          r.meansAreStated === true, `${r.meanKt} kt / ${r.meanSizeM} m / ${r.meanLifeS} s asked for 10 / 400 / 120`);
    check('a hole is the shallower half of the same signal', r.lullIsShallower === true,
          `lull ${r.meanLullKt} kt vs gust ${r.meanKt} kt`);
    // This was `puffShiftiness`, a venue variable. Two sources on one course can now turn
    // the wind by different amounts, which is the whole point of moving it.
    check('veer belongs to the SOURCE, not the venue', r.veerIsPerSource === true, r.veerPair);

    check('bias 1 makes nothing but gusts', r.allGust === 20, String(r.allGust));
    check('bias 0 makes nothing but holes', r.allLull === 0, String(r.allLull));
    check('an unstated bias is an even mix — there is no venue split left to defer to',
          r.defaultMixed === true, `${r.defaultCount}/20 gusts`);

    check('a puff from a source is real wind in getWindAt', r.puffLifts === true,
          `+${r.puffDelta} kt`);

    console.log('\nthe shape of a puff');
    check('the cell falls off on a smoothstep, not a straight line',
          r.rimRatio < 0.20 && Math.abs(r.midRatio - 0.5) < 0.05,
          `0.75 out -> ${r.rimRatio} (linear would be 0.25), halfway -> ${r.midRatio}`);
    check('the puff reaches further UPWIND of its centre than downwind — a nose and a tail',
          r.tailReaches === true && r.noseIsShorter === true);
    check('the flanks of a puff turn the wind OPPOSITE ways — it fans out as it lands',
          r.fanSplits === true, `${r.fanDeg} deg`);
    check('...and dead on its axis there is no shift at all, just pressure', r.axisNoFan === true);
    check('a lull CONVERGES instead — the same constant, the other sign', r.lullConverges === true);

    // Not just the puff variables — the whole venue weather table is gone. Wind, gusts and
    // current are each stated by their own regions.
    check('a venue has no weather variables left at all',
          r.noCondTable === true && r.noCondOnDocs === true);

    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    await browser.close();
    process.exit(failures ? 1 : 0);
})();
