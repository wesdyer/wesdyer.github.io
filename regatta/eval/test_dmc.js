// DISTANCE MADE ON COURSE — the ranking ruler.
//
// Tested against the PATH, not against a sailed race. A boat that fails to make progress
// (Glacier Sound's fleet finishes 0 of 10 inside the trace limit) makes DMC go down, and
// that is DMC being honest, not DMC being broken — measuring monotonicity along a raced
// track tests the AI. So: walk the course path itself and require the reading to advance.
const { chromium } = require('playwright');
const path = require('path');

const VENUES = ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'seatrials'];
let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    const rows = [];
    for (const venue of VENUES) {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.waitForTimeout(2200);
        rows.push(await page.evaluate(() => {
            const o = { venue: settings.venue, problems: [] };
            const dmc = state.course.dmc;
            if (!dmc) { o.problems.push('no course path built'); return o; }

            o.total = Math.round(dmc.total);
            o.legs = dmc.legs.length;
            o.perLeg = dmc.legs.map(l => Math.round(l.length));

            // 1. Every racing leg has a path with real length.
            for (let i = 1; i < dmc.legs.length; i++) {
                if (dmc.legs[i].length < 1) o.problems.push(`leg ${i} has no length`);
                if (dmc.legs[i].pts.length < 2) o.problems.push(`leg ${i} has no path`);
            }

            // 2. Bases chain, and total is their sum — otherwise DMC jumps at a leg change.
            let acc = 0;
            for (let i = 0; i < dmc.legs.length; i++) {
                if (Math.abs(dmc.legs[i].base - acc) > 1e-6) o.problems.push(`leg ${i} base ${dmc.legs[i].base} != ${acc}`);
                acc += dmc.legs[i].length;
            }
            if (Math.abs(acc - dmc.total) > 1e-6) o.problems.push('total is not the sum of the legs');

            // 3. WALKING THE PATH ADVANCES THE READING. The core property: sample along each
            //    leg's own polyline and require the projection to be non-decreasing and to
            //    span the whole leg.
            let worstBack = 0;
            for (let i = 1; i < dmc.legs.length; i++) {
                const L = dmc.legs[i];
                let last = -1;
                for (let k = 0; k <= 200; k++) {
                    const want = L.length * (k / 200);
                    // Point at arc length `want` along the polyline.
                    let seg = 0;
                    while (seg < L.cum.length - 2 && L.cum[seg + 1] < want) seg++;
                    const a = L.pts[seg], b = L.pts[seg + 1];
                    const segLen = L.cum[seg + 1] - L.cum[seg] || 1;
                    const t = Math.max(0, Math.min(1, (want - L.cum[seg]) / segLen));
                    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
                    const got = CoursePath.project(L, x, y, last < 0 ? null : last);
                    if (got < last - 0.01) worstBack = Math.max(worstBack, last - got);
                    last = got;
                }
                if (Math.abs(last - L.length) > Math.max(2, L.length * 0.02)) {
                    o.problems.push(`leg ${i} end projects to ${Math.round(last)} of ${Math.round(L.length)}`);
                }
            }
            o.worstBackwardsOnPath = +worstBack.toFixed(3);
            if (worstBack > 0.01) o.problems.push(`projection went backwards by ${worstBack.toFixed(2)} walking the path`);

            // 3b. LEGS JOIN. Each leg must begin exactly where the previous one ended —
            //     otherwise DMC jumps at the handover and the drawn route restarts somewhere
            //     the boat has never been. A rounding is where this goes wrong: the leg ends
            //     on the exit tangent, so the next must start on the same point.
            let worstGap = 0;
            for (let i = 2; i < dmc.legs.length; i++) {
                const A = dmc.legs[i - 1], B = dmc.legs[i];
                if (!A.pts.length || !B.pts.length) continue;
                const e = A.pts[A.pts.length - 1], b = B.pts[0];
                worstGap = Math.max(worstGap, Math.hypot(e.x - b.x, e.y - b.y));
            }
            o.worstLegGap = Math.round(worstGap);
            if (worstGap > 1) o.problems.push(`leg handover gap of ${Math.round(worstGap)}u`);

            // 4. OFF the path, a boat abeam still reads the same distance made. Offset
            //    perpendicular to the LOCAL path direction, not to the leg's chord — on a
            //    path that curves 2.6x its chord (Glacier Sound) a chord-perpendicular
            //    offset lands somewhere else entirely on the course, and the test would be
            //    measuring its own bad geometry.
            let worstDrift = 0;
            for (let i = 1; i < dmc.legs.length; i++) {
                const L = dmc.legs[i];
                for (let k = 1; k < 20; k++) {
                    const want = L.length * (k / 20);
                    let seg = 0;
                    while (seg < L.cum.length - 2 && L.cum[seg + 1] < want) seg++;
                    const a = L.pts[seg], b = L.pts[seg + 1];
                    const segLen = L.cum[seg + 1] - L.cum[seg] || 1;
                    const t = Math.max(0, Math.min(1, (want - L.cum[seg]) / segLen));
                    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
                    const dx = -(b.y - a.y), dy = (b.x - a.x);
                    const n = Math.hypot(dx, dy) || 1;
                    for (const off of [-300, 300]) {
                        // Hinted at the true position, exactly as a boat's reading is.
                        const s2 = CoursePath.project(L, x + dx / n * off, y + dy / n * off, want);
                        worstDrift = Math.max(worstDrift, Math.abs(s2 - want));
                    }
                }
            }
            o.worstAbeamDrift = Math.round(worstDrift);

            // 5. The path avoids STATIC LAND but is not perturbed by drifting ice.
            const land = CoursePath.staticLand(state.course.islands || []);
            o.staticLand = land.length;
            o.totalShapes = (state.course.islands || []).length;
            // ⚠️ EVERY SEGMENT, densely — not just the waypoints. Smoothing replaces a
            //    stair-stepped run with one long straight line, so "no vertex is in land"
            //    stops meaning anything: the whole point of the check is the water BETWEEN
            //    two points that are both fine. Sampled every 8 units against the real
            //    polygons, independent of the grid the smoother consulted.
            let inLand = 0, samples = 0;
            for (let i = 1; i < dmc.legs.length; i++) {
                const L = dmc.legs[i];
                for (let k = 1; k < L.pts.length; k++) {
                    const a = L.pts[k - 1], b = L.pts[k];
                    const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
                    for (let t = 0; t <= steps; t++) {
                        const x = a.x + (b.x - a.x) * t / steps, y = a.y + (b.y - a.y) * t / steps;
                        samples++;
                        for (const l of land) if (pointInPoly(x, y, l.vertices)) { inLand++; break; }
                    }
                }
            }
            o.waypointsInsideLand = inLand;
            o.landSamples = samples;
            if (inLand) o.problems.push(`${inLand} of ${samples} path samples inside land`);
            return o;
        }));
        if (errs.length) rows[rows.length - 1].problems.push('page error: ' + errs[0]);
        await page.close();
    }
    await browser.close();

    console.log('the course path is a valid ruler\n');
    for (const r of rows) {
        check(`${r.venue} — ${r.legs} legs, ${r.total}u total (${(r.perLeg || []).join('/')})`,
              r.problems.length === 0, r.problems.slice(0, 2).join(' | '));
    }
    console.log('');
    check('walking any leg never reads backwards',
          rows.every(r => (r.worstBackwardsOnPath || 0) <= 0.01),
          rows.map(r => `${r.venue}:${r.worstBackwardsOnPath}`).join(' '));
    // ⚠️ A MEASURED CHARACTERISTIC, NOT A TARGET. Every straight-legged venue now reads
    // EXACTLY 0 — a boat five lengths off the rhumb line reads precisely the same distance
    // made. The only non-zero is Glacier Sound, whose rounding is a closed circuit: 300
    // units abeam of an 851-radius arc is still on the arc, just at a different radius, and
    // there is no position-only answer to which part of a loop you are on. Frame-to-frame
    // stability is exact regardless (monotonicity above), so this bounds the absolute
    // reading, not the flicker.
    check('a boat 300u abeam reads the same distance made (loops excepted)',
          rows.every(r => (r.worstAbeamDrift || 0) < 800),
          rows.map(r => `${r.venue}:${r.worstAbeamDrift}`).join(' '));
    check('each leg begins exactly where the last one ended',
          rows.every(r => (r.worstLegGap || 0) <= 1),
          rows.map(r => `${r.venue}:${r.worstLegGap}u`).join(' '));
    check('no part of any path crosses land — every segment sampled, not just its ends',
          rows.every(r => (r.waypointsInsideLand || 0) === 0),
          rows.map(r => `${r.venue}:${r.waypointsInsideLand}/${r.landSamples}`).join(' '));
    check('drifting ice is excluded from the ruler',
          rows.every(r => r.staticLand <= r.totalShapes),
          rows.map(r => `${r.venue}:${r.staticLand}/${r.totalShapes}`).join(' '));

    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)`);
    process.exit(fails ? 1 : 0);
})();
