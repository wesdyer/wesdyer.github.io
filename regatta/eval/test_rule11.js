// RULE 11 — WINDWARD/LEEWARD, ALL POINTS OF SAIL (owner report 2026-08-09:
// "I sometimes see a windward boat getting rights over a leeward boat")
//
// The definition (RRS): "A boat's leeward side is the side that is or, when
// she is head to wind, was away from the wind... When two boats on the same
// tack overlap, the boat on the LEEWARD SIDE OF THE OTHER is the leeward
// boat." — a HULL-SIDE notion that rotates with heading. The engine projects
// onto the fixed wind-perpendicular axis with a tack-based sign; the leeward
// side's perpendicular component FLIPS SIGN at a beam reach, so the suspicion
// is an inversion on broad reaches and runs.
//
// Unit tests on the engine: boats placed by hand, Rules.getRightOfWay() read.
//   node regatta/eval/test_rule11.js
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

    const cases = await page.evaluate(() => {
        window.resetGame(); window.startRace();
        for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
        const bots = state.boats.filter(b => !b.isPlayer);
        const A = bots[0], B = bots[1];
        for (const o of state.boats) if (o !== A && o !== B) { o.x = -1e6; o.y = -1e6; o.raceState.finished = true; }
        // mid-water spot far from every mark (no zone latching)
        let px = 0, py = 0;
        outer: for (let ry = -2000; ry <= 2000; ry += 250) for (let rx = -2000; rx <= 2000; rx += 250) {
            let minD = 1e9;
            for (const m of state.course.marks) minD = Math.min(minD, Math.hypot(rx - m.x, ry - m.y));
            if (minD > 800) { px = rx; py = ry; break outer; }
        }
        const wd = getWindAt(px, py).direction;
        const out = [];
        const place = (name, twa, boom, offSide, expect) => {
            // offSide: +1 = B placed off A's PHYSICAL LEEWARD side (B should be ROW)
            //          -1 = B off A's windward side (A should be ROW)
            const h = normalizeAngle(wd + twa);
            const tackStar = boom != null ? boom > 0 : twa < 0; // engine tack convention
            // physical leeward side dir: port for starboard tack, starboard for port tack
            const leewardDir = tackStar ? [-Math.cos(h), -Math.sin(h)] : [Math.cos(h), Math.sin(h)];
            A.x = px; A.y = py; A.heading = h;
            B.x = px + leewardDir[0] * 60 * offSide; B.y = py + leewardDir[1] * 60 * offSide;
            B.heading = h;
            for (const b of [A, B]) {
                b.raceState.isTacking = false; b.raceState.ocs = false; b.raceState.penalty = false;
                b.speed = 1.0;
                if (boom != null) b.boomSide = boom; else b.boomSide = tackStar ? 1 : -1;
                b.lastLocalWindSide = null;
            }
            Rules.update(1 / 60);
            const r = Rules.getRightOfWay(A, B);
            const tA = Rules.getTack(A), tB = Rules.getTack(B);
            const ov = Rules.isOverlapped(A, B);
            out.push({ name, expect, got: r.boat === A ? 'A' : r.boat === B ? 'B' : 'null',
                rule: r.rule, reason: r.reason, tA, tB, ov,
                twaDeg: Math.round(twa * 180 / Math.PI) });
        };
        // controls upwind (engine believed correct there)
        place('upwind STBD, B on A leeward side -> B row', -0.75, null, +1, 'B');
        place('upwind STBD, B on A windward side -> A row', -0.75, null, -1, 'A');
        place('upwind PORT, B on A leeward side -> B row', +0.75, null, +1, 'B');
        place('upwind PORT, B on A windward side -> A row', -0.75 + Math.PI * 0, null, -1, 'A');
        // beam reach (the hinge)
        place('beam STBD, B on A leeward side -> B row', -1.57, null, +1, 'B');
        // broad reach (suspected inversion)
        place('broad STBD, B on A leeward side -> B row', -2.3, null, +1, 'B');
        place('broad STBD, B on A windward side -> A row', -2.3, null, -1, 'A');
        place('broad PORT, B on A leeward side -> B row', +2.3, null, +1, 'B');
        place('broad PORT, B on A windward side -> A row', +2.3, null, -1, 'A');
        // dead run, boom decides tack (boom+ = starboard per engine mapping)
        place('run boom+ (STBD), B on A leeward side -> B row', Math.PI - 0.05, 1, +1, 'B');
        place('run boom+ (STBD), B on A windward side -> A row', Math.PI - 0.05, 1, -1, 'A');
        place('run boom- (PORT), B on A leeward side -> B row', Math.PI - 0.05, -1, +1, 'B');
        return out;
    });
    console.log('RULE 11 point-of-sail matrix:');
    for (const c of cases) {
        const ok = c.got === c.expect && c.rule === 'Rule 11' && c.ov && c.tA === c.tB;
        check(c.name, ok, `got ${c.got} via ${c.rule}/${c.reason} (expect ${c.expect}; tacks ${c.tA}/${c.tB} ov=${c.ov} twa=${c.twaDeg})`);
    }
    if (errs.length) { console.log('PAGE ERRORS:', errs.slice(0, 3)); fails++; }
    console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
    await browser.close();
    process.exit(fails ? 1 : 0);
})();
