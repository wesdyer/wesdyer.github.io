// Does the RUNTIME actually contain boats inside a polygon arena?
//
//   node regatta/eval/test_boundary_race.js
//
// Run in the GAME page, not the editor: the editor can prove a rect boundary reaches
// the compiled course, but only a real race proves the eleven migrated sites — the
// physics clamp, the AI's exit test, floe drift, ice placement — actually respect a
// shape instead of a radius. Storing a polygon the runtime ignores would look
// identical in the editor.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};

(async () => {
    const browser = await chromium.launch();
    const HARNESS = fs.readFileSync('regatta/eval/trace_harness.js', 'utf8');

    async function race(shape) {
        const page = await browser.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(e.message));
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.addScriptTag({ content: HARNESS });
        await page.evaluate(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));

        const out = await page.evaluate((mode) => {
            const d = window.VENUE_DOC.arctic;
            const half = d.world.size / 2;
            if (mode === 'rect') {
                d.world.boundary = { poly: window.Arena.rectPoly(0, 0, half, half), circle: null };
            } else if (mode === 'octagon') {
                // A non-axis-aligned shape, so the tests cannot pass by accident on
                // rectangles that happen to agree with a bounding box.
                const poly = [];
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + 0.3;
                    poly.push([Math.cos(a) * half * 0.9, Math.sin(a) * half * 0.78]);
                }
                d.world.boundary = { poly, circle: null };
            } else {
                d.world.boundary = { circle: { x: 0, y: 0, r: half }, poly: null };
            }

            window.traceHarness.seed = 90210;
            Math.random = () => window.traceHarness.random();
            resetGame();
            startRace();

            const b = state.course.boundary;
            let worstBoat = 0, worstFloe = 0, boatSamples = 0, floeSamples = 0;
            for (let i = 0; i < 5400; i++) {          // 30s prestart + 60s racing
                update(1 / 60);
                if (i % 15) continue;
                for (const bt of state.boats) {
                    boatSamples++;
                    const sd = window.Arena.signedDist(b, bt.x, bt.y);
                    if (sd < worstBoat) worstBoat = sd;
                }
                for (const f of (state.course.islands || [])) {
                    if (f.fromMask) continue;            // authored land, not drift
                    floeSamples++;
                    const sd = window.Arena.signedDist(b, f.x, f.y);
                    if (sd < worstFloe) worstFloe = sd;
                }
            }
            // Ice placement at generation time, before any drift.
            const placed = (state.course.islands || []).filter(f => !f.fromMask);
            const outsideAtBirth = placed.filter(f => window.Arena.signedDist(b, f.x, f.y) < -f.radius).length;

            return {
                poly: b.poly ? b.poly.length : 0,
                worstBoat, worstFloe, boatSamples, floeSamples,
                floes: placed.length, outsideAtBirth,
                brash: (state.course.brash || []).length,
                brashOutside: (state.course.brash || [])
                    .filter(x => window.Arena.signedDist(b, x.x, x.y) < -200).length
            };
        }, shape);
        await page.close();
        return { out, errs };
    }

    for (const shape of ['circle', 'rect', 'octagon']) {
        console.log(`\n${shape} arena`);
        const { out, errs } = await race(shape);
        check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
        check(`arena is a ${shape === 'circle' ? 'circle' : 'polygon'}`,
              shape === 'circle' ? out.poly === 0 : out.poly > 0, `poly=${out.poly}`);
        // The physics clamp lands boats ON the edge, so allow a hull's worth of
        // overshoot within a frame but no more.
        check('boats stay inside', out.worstBoat > -60,
              `worst ${out.worstBoat.toFixed(2)}u over ${out.boatSamples} samples`);
        check('ice is placed inside', out.outsideAtBirth === 0,
              `${out.outsideAtBirth} of ${out.floes} floes born outside`);
        // Floes drift and are bounced back, so they may briefly graze the edge.
        check('drifting ice is kept inside', out.worstFloe > -400,
              `worst ${out.worstFloe.toFixed(2)}u over ${out.floeSamples} samples`);
        check('brash stays inside', out.brashOutside === 0,
              `${out.brashOutside} of ${out.brash} brash outside`);
        console.log(`         ${out.floes} floes, ${out.brash} brash; worst boat ${out.worstBoat.toFixed(1)}u, worst floe ${out.worstFloe.toFixed(1)}u`);
    }

    await browser.close();
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
