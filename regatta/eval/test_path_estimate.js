// PATH ESTIMATE — is the distance the editor reports a distance a boat can actually sail?
//
//   node regatta/eval/test_path_estimate.js
//
// THE CHECK THIS FILE EXISTS FOR is "a SHORT way round is still a way round". The estimate
// measures each hop with a hull-width BFS, and an 8-connected BFS stair-steps: a clear run
// comes back up to ~8% longer than the straight line it should be. That was corrected with
// a THRESHOLD — take the straight line whenever the routed path is within 8% of it — and a
// threshold cannot tell grid noise from a genuine short detour.
//
// Measured on Glowtide Strait before the fix: the `pre4` hop found an honest 1823u path
// around a headland, and because that is 1.065x the straight line the estimate threw it
// away and priced 1711u of line that is 40% LAND. Lake had the same failure at 10%. The
// number also jumped as marks were dragged, because a hop crosses 1.08 in either direction.
//
// The fix is string-pulling, and the first half of this file is a SYNTHETIC case rather
// than a venue: venue geometry is edited constantly, and a regression guard that depends on
// where somebody left a mark is a guard that rots. The second half is the property that has
// to hold everywhere — the measured path stays on water.
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
    await page.goto('file://' + path.resolve('regatta/editor.html'));
    await page.waitForFunction(() => window.EditorApp && window.SailCheck);

    // ── 1. A SHORT DETOUR, ON A GRID BUILT FOR THE PURPOSE ───────────────────
    console.log('a short way round is still a way round (synthetic)');
    const syn = await page.evaluate(() => {
        const S = window.SailCheck;
        const arena = { poly: [[-3000, -3000], [3000, -3000], [3000, 3000], [-3000, 3000]] };
        // A stub of land straddling the rhumb line: 300u tall, at x = 0, y = -1000.
        // SIZED ON PURPOSE. The way round has to be long enough to be real and short
        // enough to fall UNDER the old 8% bar, or the test passes without ever
        // exercising the bug. Measured across stub heights, the BFS ratio goes
        // 1.041x (h=100) / 1.055x (h=150) / 1.069x (h=200) / 1.083x (h=250) — so 150
        // sits mid-window, clear of both the bar and the noise floor.
        const wall = { outer: [[-20, -1150], [20, -1150], [20, -850], [-20, -850]], holes: [] };
        const grid = S.buildGrid([wall], arena, null, null);
        const A = { x: -1500, y: -1000 }, B = { x: 1500, y: -1000 };
        const straight = Math.hypot(B.x - A.x, B.y - A.y);
        const seg = S.pathBetween(grid, [A.x, A.y], [B.x, B.y]);
        if (!seg) return { noPath: true };
        let raw = 0;
        for (let i = 1; i < seg.length; i++) raw += Math.hypot(seg[i][0] - seg[i-1][0], seg[i][1] - seg[i-1][1]);
        seg[0] = [A.x, A.y]; seg[seg.length - 1] = [B.x, B.y];
        const taut = S.smoothPath(grid, seg);
        let L = 0;
        for (let i = 1; i < taut.length; i++) L += Math.hypot(taut[i][0] - taut[i-1][0], taut[i][1] - taut[i-1][1]);
        const clear = (ax, ay, bx, by) => S.losClear(grid, ax, ay, bx, by);
        let allClear = true;
        for (let i = 1; i < taut.length; i++)
            if (!clear(taut[i-1][0], taut[i-1][1], taut[i][0], taut[i][1])) allClear = false;
        return { straight, raw, taut: L, pts: taut.length,
                 straightIsBlocked: !clear(A.x, A.y, B.x, B.y), allClear };
    });
    check('the grid finds a way round the stub', !syn.noPath);
    check('the straight line between them is BLOCKED', syn.straightIsBlocked === true);
    check('...and the way round is under the old 8% bar, so the threshold straightened it',
          syn.raw / syn.straight < 1.08,
          `raw ${Math.round(syn.raw)}u vs straight ${Math.round(syn.straight)}u `
          + `= ${(syn.raw / syn.straight).toFixed(3)}x`);
    check('the measured path keeps the detour instead of the straight line',
          syn.taut > syn.straight + 1,
          `taut ${Math.round(syn.taut)}u vs straight ${Math.round(syn.straight)}u`);
    check('every segment of the measured path is on water', syn.allClear === true);
    check('string-pulling still removes the stair-stepping', syn.taut < syn.raw,
          `taut ${Math.round(syn.taut)}u vs raw BFS ${Math.round(syn.raw)}u`);

    // ── 2. A CLEAR RUN MEASURES THE STRAIGHT LINE, EXACTLY ───────────────────
    // What the threshold was reaching for, and the reason it can now be deleted rather
    // than retuned: with no land in the way both ends see each other, the whole path
    // collapses to one segment, and the length IS the straight line.
    console.log('\na clear run measures the straight line');
    const clr = await page.evaluate(() => {
        const S = window.SailCheck;
        const arena = { poly: [[-3000, -3000], [3000, -3000], [3000, 3000], [-3000, 3000]] };
        const grid = S.buildGrid([], arena, null, null);
        const A = { x: -1500, y: -1000 }, B = { x: 1500, y: -1000 };
        const straight = Math.hypot(B.x - A.x, B.y - A.y);
        const seg = S.pathBetween(grid, [A.x, A.y], [B.x, B.y]);
        seg[0] = [A.x, A.y]; seg[seg.length - 1] = [B.x, B.y];
        const taut = S.smoothPath(grid, seg);
        let L = 0;
        for (let i = 1; i < taut.length; i++) L += Math.hypot(taut[i][0] - taut[i-1][0], taut[i][1] - taut[i-1][1]);
        return { straight, taut: L, pts: taut.length };
    });
    check('open water collapses to a single segment', clr.pts === 2, `${clr.pts} points`);
    check('...and measures the straight line to the unit', Math.abs(clr.taut - clr.straight) < 1e-6,
          `${clr.taut.toFixed(3)}u vs ${clr.straight.toFixed(3)}u`);

    // ── 3. THE PROPERTY, ON THE SHIPPED VENUES ───────────────────────────────
    // Not a number that goes stale — a claim about what the estimate reports. The first
    // and last segment of a hop touch the waypoint itself, which a venue is allowed to
    // put on land (`nearestNav` exists for exactly that); those are a venue finding and
    // are checked elsewhere, so the property here is about the water in between.
    console.log('\nthe measured path stays on water, on every venue');
    for (const venue of ['bay', 'lake', 'lagoon', 'river', 'redrock', 'ocean', 'arctic']) {
        const r = await page.evaluate(async (venue) => {
            const A = window.EditorApp, S = window.SailCheck, VD = window.VenueDoc;
            A.loadVenue(venue);
            await new Promise(r => setTimeout(r, 600));
            const doc = A._state().doc, course = window.state.course;
            const est = A._estimate();
            const solid = VD.shapes(doc).filter(sh => {
                const t = VD.traits(sh); return t.motion === 'fixed' && !t.awash;
            });
            const grid = S.buildGrid(solid, course.boundary, null,
                VD.shapes(doc).some(sh => VD.traits(sh).motion !== 'fixed') ? { noSubsample: true } : null);
            const wps = S.routeWaypoints(course.marks, course.route, grid);
            const DIRECT = grid.res * 5;
            let prev = null, bad = 0, hops = 0, worstInflation = 1, rebuilt = 0;
            for (const wp of wps) {
                if (prev) {
                    const straight = Math.hypot(wp.x - prev.x, wp.y - prev.y);
                    let used = straight;
                    if (straight > DIRECT) {
                        const seg = S.pathBetween(grid, [prev.x, prev.y], [wp.x, wp.y]);
                        if (seg && seg.length) {
                            hops++;
                            seg[0] = [prev.x, prev.y]; seg[seg.length - 1] = [wp.x, wp.y];
                            const taut = S.smoothPath(grid, seg);
                            let L = 0;
                            for (let i = 1; i < taut.length; i++) {
                                L += Math.hypot(taut[i][0] - taut[i-1][0], taut[i][1] - taut[i-1][1]);
                                const interior = i > 1 && i < taut.length - 1;
                                if (interior && !S.losClear(grid, taut[i-1][0], taut[i-1][1], taut[i][0], taut[i][1])) bad++;
                            }
                            if (S.losClear(grid, prev.x, prev.y, wp.x, wp.y))
                                worstInflation = Math.max(worstInflation, L / straight);
                            used = L;
                        }
                    }
                    rebuilt += used;
                }
                prev = wp;
            }
            return { hops, bad, worstInflation: +worstInflation.toFixed(4),
                     rebuilt: Math.round(rebuilt),
                     estDist: est ? Math.round(est.dist) : null };
        }, venue);
        check(`${venue}: no measured segment crosses land`, r.bad === 0,
              `${r.bad} of ${r.hops} hops`);
        check(`${venue}: a clear hop is not inflated by stair-stepping`, r.worstInflation < 1.01,
              `worst ${r.worstInflation}x`);
        // BINDS THE ESTIMATOR TO THE HELPER. Everything above tests `smoothPath`; this
        // tests that `routeEstimate` is what calls it. Reinstate the 8% threshold inside
        // the estimator and the two numbers part company, which nothing else here notices.
        check(`${venue}: the reported distance is the taut path, hop for hop`,
              r.estDist != null && Math.abs(r.estDist - r.rebuilt) <= Math.max(2, r.rebuilt * 0.001),
              `estimate ${r.estDist}u vs taut sum ${r.rebuilt}u`);
    }

    check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    await browser.close();
    process.exitCode = failures ? 1 : 0;
})();
