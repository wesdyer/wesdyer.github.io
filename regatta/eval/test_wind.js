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

        // Edge ramp: the falloff band is CENTERED on the outline — half-weight on the
        // drawn edge, calm at falloff/2 outside, full at falloff/2 inside (that is what
        // lets two abutting regions blend breeze into breeze instead of dipping to calm).
        // Walk from just outside the band to just inside it: -2850 is falloff/2 outside
        // A's left edge at -2700, and 8 x 45u ends 210u inside, past the +150u ramp end.
        const ramp = [];
        for (let k = 0; k <= 8; k++) ramp.push(sample(-2850 + k * 45, 0).s);

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

        // A REGION STATES ITS OWN SPEED. Absent is CALM, not "ask the venue" — a region that
        // looked authored but silently borrowed a number blew at different strengths on
        // different venues with identical fields.
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
    // ── An AUTHORED current is a current the whole game can see ─────────────
    // Every readout used to ask `state.race.riverCurrent`, which was the same question as
    // "does this venue have a stream" only while the river was the only venue with one. A
    // region authored on any other venue pushed the fleet around while the water tile
    // showed the static blurb, the streamlines never spawned, and the current knob offered
    // to override a field it could not see.
    console.log('\nan authored current region');
    const cur = await page.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
        resetGame();
        // getCurrentAt returns NULL, not a zero vector, when nothing is flowing —
        // ambientCurrentAt hands back `conditions.current`, which is null by default.
        const before = { vc: !!venueCurrent(), at: (getCurrentAt(0, 0) || {}).speed || 0 };
        // A 2000-unit square about the origin, flowing due EAST at 2 kn. Falloff 500, so
        // the middle is at full strength and the rim is calm.
        const poly = [[-1000, -1000], [1000, -1000], [1000, 1000], [-1000, 1000]];
        state.course.currentRegions = [{
            id: 'test-stream', poly,
            bb: { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 },
            falloff: 500, direction: Math.PI / 2, speed: 2, speedVar: 0, dirVar: 0,
            period: 0, phase: 0
        }];
        const mid = getCurrentAt(0, 0);
        const out = getCurrentAt(4000, 4000);
        const vc = venueCurrent();
        return {
            before,
            midSpeed: mid.speed, midDir: mid.direction,
            outSpeed: (out && out.speed) || 0,
            vcMax: vc && vc.max, vcText: vc && vc.text
        };
    });
    check('a venue with no region has no current at all',
          cur.before.vc === false && cur.before.at === 0, JSON.stringify(cur.before));
    check('inside the region the water runs at the authored speed',
          near(cur.midSpeed, 2, 0.01), `${cur.midSpeed} kn`);
    check('...in the authored direction — due east', nearAng(cur.midDir, Math.PI / 2, 0.01),
          `${(cur.midDir * 180 / Math.PI).toFixed(1)}°`);
    check('outside it the water is still', cur.outSpeed === 0, `${cur.outSpeed} kn`);
    check('the venue reports the stream it owns', near(cur.vcMax, 2, 0.01) && !!cur.vcText,
          `${cur.vcMax} · ${cur.vcText}`);
    // The pre-race "customize conditions" panel is gone — a course's current is stated by
    // its document, so there is no knob left to lock and nothing on that screen to read it
    // back to. What the venue reports is still checked, one assertion up.

    // ── Shadows: the lee of a solid thing ───────────────────────────────────
    // Wind shadow existed and was switched OFF for every venue: the guard skipped anything
    // with `fromMask`, which meant "traced from a painted mask" (one venue) until compile
    // started setting it on every authored shape (all ten). The fix is the same one that
    // lets a coastline cast a shadow at all — cast it from the SILHOUETTE rather than from
    // a centroid and a bounding radius.
    console.log('\nwind and current shadows');
    const shade = await page.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' }));
        resetGame();
        const o = {}, isl = state.course.navIslands.filter(i => !i.isFloe);
        const s = isl[0];

        // A SHAPE CASTS ITS LEE DOWN THE WIND AT ITSELF, so these sweep the FIELD rather than
        // handing shadowAt a direction — there is no direction to hand it any more, and the
        // old signature only worked while one global angle stood for the wind everywhere.
        //
        // Clearing the regions makes the field uniform, so `state.wind.direction` IS the wind
        // at the island and the probe geometry below is exact. With regions left in place the
        // island would take its own blended angle and the probes would be aimed elsewhere —
        // which is the real behaviour, and is what the region tests above cover.
        state.course.windRegions = [];
        const shadeAt = (x, y, dir) => { state.wind.direction = dir; return shadowAt(x, y, null, 'wind'); };

        // NOTHING casts a lee until it is given a height — that is the default, deliberately,
        // so the feature existing does not change how ten venues sail.
        o.silentByDefault = shadeAt(s.x + 1, s.y + 1, state.wind.direction) === 1
            && isl.every(i => !(i.height > 0));
        s.height = 40;                        // 40 m of rock -> 400 m of bad air, at 10 heights
        // Downwind is thin, upwind is untouched — at EVERY wind direction, because a shadow
        // that does not turn with the breeze is in the wrong place the moment it shifts.
        o.lee = [], o.luff = [];
        for (let d = 0; d < 360; d += 45) {
            const r = d * Math.PI / 180, fx = -Math.sin(r), fy = Math.cos(r);
            o.lee.push(+shadeAt(s.x + fx * s.radius * 2, s.y + fy * s.radius * 2, r).toFixed(2));
            o.luff.push(+shadeAt(s.x - fx * s.radius * 2, s.y - fy * s.radius * 2, r).toFixed(2));
        }
        // One FIXED point is shadowed at one wind angle and clear at the rest.
        o.fixed = [];
        for (let d = 0; d < 360; d += 45)
            o.fixed.push(+shadeAt(s.x + s.radius * 2, s.y, d * Math.PI / 180).toFixed(2));
        // It fades with distance rather than stopping at a wall.
        const d0 = state.wind.baseDirection; state.wind.direction = d0;
        const fx = -Math.sin(d0), fy = Math.cos(d0);
        const len = window.shadowLengthOf(s, 'wind');
        // Sampled as FRACTIONS OF THE PLUME, not as multiples of the island's radius. The
        // radius version happened to straddle the end of the shadow at one particular value
        // of SHADOW_HEIGHTS and reported a false wall the moment that constant moved — so it
        // was testing the constant, not the property. The last sample is past the tail by
        // construction, which is what "ends in clear air" actually means.
        o.profile = [0.1, 0.3, 0.5, 0.8, 1.2].map(k =>
            +shadeAt(s.x + fx * (s.radius + len * k), s.y + fy * (s.radius + len * k), d0).toFixed(2));
        // Step sizes along the plume: an S-curve's are small, large, small.
        const walk = [];
        for (let t = 0; t <= 1.0001; t += 0.1)
            walk.push(shadeAt(s.x + fx * (s.radius + len * t), s.y + fy * (s.radius + len * t), d0));
        o.steps = walk.map(v => +v.toFixed(2));
        const step = walk.slice(1).map((v, i) => v - walk[i]);
        const mid = step[Math.floor(step.length / 2)];
        o.sCurve = mid > step[0] * 1.5 && mid > step[step.length - 1] * 1.5;

        // Authoring the LENGTH directly overrides the height-derived one, and 0 means none.
        s.windShadow = 0;
        o.zeroCastsNone = shadeAt(s.x + fx * s.radius * 2, s.y + fy * s.radius * 2, d0) === 1;
        s.windShadow = s.radius * 12;
        o.longerReaches = shadeAt(s.x + fx * s.radius * 8, s.y + fy * s.radius * 8, d0) < 0.99;
        delete s.windShadow;
        // Height is what sets it: taller casts further, which is the whole model.
        const at3r = () => shadeAt(s.x + fx * s.radius * 3, s.y + fy * s.radius * 3, d0);
        s.height = 10; const shortH = at3r();
        s.height = 90; const tallH = at3r();
        o.tallerCastsFurther = tallH < shortH;
        s.height = 40; s._sil = null;

        // A COASTLINE must shadow a band, not the map — the failure that switched the whole
        // model off. Measured as the share of open water in any degree of lee.
        //
        // THE COASTLINE, singular. This used to height all of Glacier Sound's shapes at once
        // and measure the total, which is really a measurement of how many shapes a designer
        // has placed: it read 29% at six shapes and 64% at a hundred and twenty-three, and
        // tipped past this bound the day the venue gained a hand-placed ice field. Neither
        // number says anything about the bug being guarded, which is one enormous outline
        // casting from a bounding circle centred inland.
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
        resetGame();
        let coast = null;
        for (const i of state.course.navIslands) {
            i.height = 0; delete i.windShadow;          // isolate: only the coast casts
            if (!coast || i.radius > coast.radius) coast = i;
        }
        coast.height = 20;                              // 20 m of shelf and shore
        o.coastRadius = Math.round(coast.radius);
        const b = state.course.boundary, dA = state.wind.direction;
        let n = 0, dim = 0;
        const onLand = (x, y) => state.course.landShapes.some(L => {
            let inside = false; const v = L.vertices;
            for (let a = 0, c = v.length - 1; a < v.length; c = a++) {
                const xi = v[a].x, yi = v[a].y, xj = v[c].x, yj = v[c].y;
                if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
            } return inside; });
        for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) {
            const x = b.x + (i / 29 - 0.5) * b.radius * 1.6, y = b.y + (j / 29 - 0.5) * b.radius * 1.6;
            if (!Arena.contains(b, x, y, 0) || onLand(x, y)) continue;
            n++; if (shadowAt(x, y, null, 'wind') < 0.999) dim++;
        }
        o.coastShare = Math.round(100 * dim / n);
        o.coastCasts = dim > 0;
        return o;
    });
    check('nothing casts a lee until it is given a height', shade.silentByDefault === true);
    check('downwind of an island the breeze is thin, at every wind direction',
          shade.lee.every(v => v < 0.75), shade.lee.join(' '));
    check('...and upwind of it is untouched', shade.luff.every(v => v === 1), shade.luff.join(' '));
    check('the shadow TURNS with the wind — one spot, shadowed at one angle',
          shade.fixed.filter(v => v < 1).length === 1, shade.fixed.join(' '));
    check('it fades with distance rather than ending at a wall',
          shade.profile.every((v, i) => i === 0 || v >= shade.profile[i - 1] - 1e-9)
          && shade.profile[0] < 0.5 && shade.profile[shade.profile.length - 1] === 1,
          shade.profile.join(' '));
    // SMOOTHSTEP, not linear. A wake holds its deficit in the near field, recovers through
    // the middle and asymptotes — so the curve is flat at both ENDS and steepest in the
    // MIDDLE. Linear was flat nowhere and met clear air with a crease you could see.
    check('...on an S-curve: flat near the obstacle, flat at the tail, steep between',
          shade.sCurve === true, shade.steps.join(' '));
    check('a length of 0 casts no lee at all', shade.zeroCastsNone === true);
    check('...and a longer one reaches further', shade.longerReaches === true);
    // The point of height: a spire and a sandbar of identical outline are different weather.
    check('a TALLER shape shadows further than a short one of the same outline',
          shade.tallerCastsFurther === true);
    // The old model cast from the centroid with the bounding radius, so Glacier Sound's
    // coast — 9400 units of bounding circle centred inland — killed the breeze everywhere.
    check('a COASTLINE shadows a band of water, not the map',
          shade.coastCasts === true && shade.coastShare > 2 && shade.coastShare < 45,
          `${shade.coastShare}% of open water in some lee`);

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

    check('a region with no speed is CALM, not the venue\'s wind',
          r.venueSpeed.s < 0.01, `${r.venueSpeed.s.toFixed(2)}kt (the venue is doing 17)`);

    check('sampling the field consumes no rng draws', r.draws === 0, `${r.draws} draws`);
    check('the representative direction is derived from the regions',
          r.windBase != null && nearAng(r.windBase, 0, 0.3), `${r.windBase}`);
    check('island wind shadowing is still in play', r.shadowStill === true);

    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
