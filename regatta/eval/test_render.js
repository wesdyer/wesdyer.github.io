// Render smoke test: call draw() across every venue and race state.
//
//   node regatta/eval/test_render.js
//
// This exists because the GOLDEN TRACES NEVER RENDER. They drive update() only, so a
// crash that lives in a draw path is completely invisible to them — and two did:
// after the placeholder marks were removed, both `drawActiveGateLine` (orienting its
// START/FINISH label by looking up "the other gate" as marks[2]) and `drawMinimap`
// (drawing a hardcoded gate at marks 2,3) read undefined and threw, taking the whole
// frame with them. Every trace still passed.
//
// So: exercise the draw path directly, across the state matrix that changes which
// nav aids, labels and gates are drawn.
const { chromium } = require('playwright');
const path = require('path');

const VENUES = ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'seatrials'];

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};

(async () => {
    const browser = await chromium.launch();
    let total = 0;

    for (const venue of VENUES) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const errs = [];
        page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
        await page.reload();
        await page.waitForTimeout(700);

        const res = await page.evaluate(() => {
            // Stop the real loop so only our explicit draw() calls run; a background
            // frame throwing would be attributed to the wrong case.
            window.requestAnimationFrame = () => 0;
            let s = 90210;
            Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame();

            const problems = [];
            const attempt = (label) => {
                try { draw(); } catch (e) { problems.push(`${label}: ${e.message}`); }
            };

            // Prestart, both nav-aid states.
            for (const aids of [false, true]) { state.showNavAids = aids; attempt(`prestart aids=${aids}`); }

            startRace();
            for (let i = 0; i < 300; i++) update(1 / 60);

            const player = state.boats.find(b => b.isPlayer) || state.boats[0];
            const maxLeg = state.race.totalLegs + 1;
            // Every leg, plus one past the finish — the state a finished player sits
            // in while the rest of the fleet is still racing, and the one most likely
            // to fall off the end of a route table.
            for (let leg = 0; leg <= maxLeg; leg++) {
                player.raceState.leg = leg;
                player.raceState.finished = leg > state.race.totalLegs;
                for (const aids of [false, true]) {
                    state.showNavAids = aids;
                    attempt(`racing leg=${leg} aids=${aids}`);
                }
            }

            // Race over, and camera modes that use different boundary/mark maths.
            state.race.status = 'finished';
            for (const aids of [false, true]) { state.showNavAids = aids; attempt(`finished aids=${aids}`); }
            state.race.status = 'racing';
            for (const target of ['boat', 'finish', 'course']) {
                state.camera.target = target;
                attempt(`camera=${target}`);
            }
            return { problems, cases: (maxLeg + 1) * 2 + 4 + 3, legs: maxLeg };
        });

        await page.close();
        total += res.cases;
        const ok = res.problems.length === 0 && errs.length === 0;
        check(`${venue} (${res.cases} draw cases, legs 0..${res.legs})`, ok,
              res.problems.concat(errs).slice(0, 3).join(' | '));
    }

    await browser.close();
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${total} draw calls, ${failures} venue(s) with problems`);
    process.exitCode = failures ? 1 : 0;
})();
