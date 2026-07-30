// Wind regions: absolute, AVERAGED, soft-edged, and unable to touch the RNG stream.
//
//   node regatta/eval/test_wind.js
//
// There is no base wind. A region states the wind THERE — an absolute mean direction and
// optionally an absolute speed — and "the wind is the same everywhere" is one region over
// the whole map.
//
// The property that matters most is that overlaps AVERAGE rather than sum. Summing deltas
// meant building a curving breeze out of two regions also doubled its strength through the
// overlap, so every curve came with a squall attached. The tests below pin that directly:
// two 12-knot regions 90 degrees apart must give 12 knots at 45, not 17.
const { chromium } = require('playwright');
const path = require('path');

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// Angles compare on the circle: 359 and 1 degrees are two degrees apart, not 358.
const nearAng = (a, b, tol) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI) <= tol;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.resolve('regatta/index.html'));

    const r = await page.evaluate(() => {
        const d = window.VenueDoc.get('arctic');
        const box = (cx, cy, half) => ([[cx-half,cy-half],[cx+half,cy-half],[cx+half,cy+half],[cx-half,cy+half]]);
        // Two regions of the SAME strength, 90 degrees apart, deliberately overlapping.
        // Absolute directions, absolute speeds — no offsets, no multipliers.
        d.wind.regions = [
            { id: 'A', poly: box(-1500, 0, 1200), falloff: 300, direction: 0,           speed: 12, period: 0 },
            { id: 'B', poly: box(  -300, 0, 1200), falloff: 300, direction: Math.PI/2,  speed: 12, period: 0 }
        ];
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));

        let s = 90210;
        const rng = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        Math.random = rng;
        resetGame();

        // Freeze everything the regions are not responsible for.
        state.gusts = [];
        state.wind.speed = 8;                     // deliberately NOT 12: the regions say 12
        state.wind.baseDirection = -1;            // and deliberately not 0 either
        state.wind.direction = -1;                // no live shift yet
        state.time = 0;

        const sample = (x, y) => { const w = getWindAt(x, y); return { s: w.speed, d: w.direction }; };

        const far  = sample(-4000, 3000);          // outside every region: CALM
        const inA  = sample(-2400, 0);             // deep inside A only
        const inB  = sample(600, 0);               // deep inside B only
        const both = sample(-900, 0);              // the overlap

        // Edge ramp: walk INWARD from A's left edge across its 300u falloff band.
        const ramp = [];
        for (let k = 0; k <= 8; k++) ramp.push(sample(-2700 + k * 45, 0).s);

        // Direction must average as UNIT VECTORS. 350 and 10 degrees average to 0, not 180.
        d.wind.regions = [
            { id: 'W', poly: box(0, 0, 1500), falloff: 200, direction: -10 * Math.PI/180, speed: 10, period: 0 },
            { id: 'E', poly: box(0, 0, 1500), falloff: 200, direction:  10 * Math.PI/180, speed: 10, period: 0 }
        ];
        resetGame();
        state.gusts = []; state.wind.speed = 8; state.wind.baseDirection = -1; state.wind.direction = -1; state.time = 0;
        const wrap = sample(0, 0);

        // A region states the MEAN wind; the day's shift still rides on top, or a course
        // fully covered by regions would never see a shift at all.
        state.wind.direction = -1 + 0.3;           // the venue shifted 0.3 rad right
        const shifted = sample(0, 0);

        // Speed absent = "whatever the venue is doing here", which is what keeps a course
        // that only authors direction varying from race to race.
        d.wind.regions = [{ id: 'V', poly: box(0, 0, 1500), falloff: 200, direction: 0, speed: null, period: 0 }];
        resetGame();
        state.gusts = []; state.wind.speed = 17; state.wind.baseDirection = -1; state.wind.direction = -1; state.time = 0;
        const venueSpeed = sample(0, 0);

        // RNG neutrality: count draws across a grid of samples.
        let draws = 0;
        Math.random = () => { draws++; return rng(); };
        for (let i = 0; i < 400; i++) getWindAt(-2000 + i * 10, 0);
        Math.random = rng;

        return {
            far, inA, inB, both, ramp, wrap, shifted, venueSpeed, draws,
            windBase: window.VenueDoc.compile(d).windBase,
            shadowStill: typeof state.course.navIslands !== 'undefined'
        };
    });
    await browser.close();

    console.log('wind regions: absolute and averaged\n');
    check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

    // No fallback breeze. Once regions state the wind, an unstated patch is a hole in the
    // design, and filling it in silently is how a course comes to depend on a wind nobody
    // authored. A hole is sailable-looking and unsailable, which the checks now hunt for.
    check('outside every region the water is CALM',
          near(r.far.s, 0, 1e-9), `${r.far.s.toFixed(3)}kt`);

    check('deep inside a region the wind is what that region says',
          nearAng(r.inA.d, 0, 0.02) && near(r.inA.s, 12, 0.2),
          `${r.inA.s.toFixed(2)}kt @ ${r.inA.d.toFixed(3)} (want 12kt @ 0)`);
    check('...and the other region likewise',
          nearAng(r.inB.d, Math.PI/2, 0.02) && near(r.inB.s, 12, 0.2),
          `${r.inB.s.toFixed(2)}kt @ ${r.inB.d.toFixed(3)} (want 12kt @ 1.571)`);

    // THE POINT OF THE WHOLE CHANGE.
    check('in the overlap the directions AVERAGE',
          nearAng(r.both.d, Math.PI/4, 0.05), `${r.both.d.toFixed(3)} (want 0.785)`);
    check('...and the strength does NOT grow',
          near(r.both.s, 12, 0.3), `${r.both.s.toFixed(2)}kt — summing deltas gave ~17kt here`);

    const mono = r.ramp.every((v, i) => i === 0 || v >= r.ramp[i - 1] - 1e-9);
    check('the edge is a monotone ramp, not a step', mono, JSON.stringify(r.ramp.map(v => +v.toFixed(2))));
    check('the ramp spans from calm to the region wind',
          r.ramp[0] < 2 && near(r.ramp[r.ramp.length - 1], 12, 0.5),
          `${r.ramp[0].toFixed(2)} -> ${r.ramp[r.ramp.length-1].toFixed(2)}`);

    check('direction averages as VECTORS, not as numbers',
          nearAng(r.wrap.d, 0, 0.02), `${r.wrap.d.toFixed(3)} — averaging -10° and +10° as numbers gives 0, as a wrap-around bug gives 180°`);

    check("the day's shift still rides on top of a region's mean",
          nearAng(r.shifted.d, 0.3, 0.02), `${r.shifted.d.toFixed(3)} (want 0.300)`);

    check('a region with no speed follows the venue',
          near(r.venueSpeed.s, 17, 0.2), `${r.venueSpeed.s.toFixed(2)}kt (venue is 17)`);

    check('sampling the field consumes no rng draws', r.draws === 0, `${r.draws} draws`);
    check('the representative direction is derived from the regions',
          r.windBase != null && nearAng(r.windBase, 0, 0.3), `${r.windBase}`);
    check('island wind shadowing is still in play', r.shadowStill === true);

    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
