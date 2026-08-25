// MULTI-BOAT OVERLAP — the intervening-boat clause (RRS Definition: Overlap)
//
//   "Two boats overlap when neither is clear astern of the other. However,
//    they also overlap when a boat between them overlaps both."
//
// Battery-style unit tests on the rules engine (test_markroom.js is the
// model): boats placed by hand, Rules stepped, verdicts read. EVERY case
// asserts its own preconditions first — two earlier markroom versions passed
// on a broken engine because the setup wasn't what it claimed.
//
// Geometry (same tack, all heading 0):
//   A (0,0)    B (60,40)    C (120,80)
//   stagger 40u: each pair 25u of fore-aft hull overlap (bow +25 / stern -30),
//   so A-B and B-C overlap directly while C's bow (y=55) is behind A's stern
//   abeam line (y=30): A-C NOT directly overlapped. B projects at t=0.5 on
//   the A->C segment — between. The clause makes A-C overlapped.
// Controls: (1) B parked far away -> A-C revert to Rule 12;
//           (2) B far abeam at (600,40) — still overlaps BOTH by the fore-aft
//               definition (overlap has no lateral cap) but is NOT between
//               (t=3.6) -> Rule 12 stands.
//
//   node _test_multioverlap.js [tree]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeMR');
let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);
    const r = await page.evaluate(() => {
        window.resetGame(); window.startRace();
        for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
        const bots = state.boats.filter(b => !b.isPlayer);
        const [A, B, C] = bots;
        for (const o of state.boats) if (o !== A && o !== B && o !== C) {
            o.x = -1e6; o.y = -1e6; o.raceState.finished = true;
        }
        const place = (b, x, y) => { b.x = x; b.y = y; b.heading = 0; b.speed = 1.0; };
        const out = {};
        place(A, 0, 0); place(B, 60, 40); place(C, 120, 80);
        out.preAB = window.Rules.isOverlapped(A, B);
        out.preBC = window.Rules.isOverlapped(B, C);
        out.preAC = window.Rules.isOverlapped(A, C);
        out.hasThrough = typeof window.Rules.isOverlappedThrough === 'function';
        if (out.hasThrough) out.throughAC = window.Rules.isOverlappedThrough(A, C);
        const ev1 = window.Rules.evaluate ? window.Rules.evaluate(A, C) : window.Rules.getRightOfWay(A, C);
        out.rule3 = ev1.rule;
        // control 1: B parked far — pairwise world
        place(B, -50000, -50000);
        const ev2 = window.Rules.evaluate ? window.Rules.evaluate(A, C) : window.Rules.getRightOfWay(A, C);
        out.ruleNoB = ev2.rule;
        if (out.hasThrough) out.throughNoB = window.Rules.isOverlappedThrough(A, C);
        // control 2: B far abeam — overlaps both, not between
        place(B, 600, 40);
        out.preAbeamBA = window.Rules.isOverlapped(B, A);
        out.preAbeamBC = window.Rules.isOverlapped(B, C);
        if (out.hasThrough) out.throughAbeam = window.Rules.isOverlappedThrough(A, C);
        const ev3 = window.Rules.evaluate ? window.Rules.evaluate(A, C) : window.Rules.getRightOfWay(A, C);
        out.ruleAbeam = ev3.rule;
        // finished boats never intervene
        place(B, 60, 40); B.raceState.finished = true;
        if (out.hasThrough) out.throughFin = window.Rules.isOverlappedThrough(A, C);
        B.raceState.finished = false;
        return out;
    });
    console.log('MULTI-BOAT OVERLAP battery on ' + ROOT.split('/').pop() + ':');
    check('pre: A-B directly overlapped', r.preAB === true);
    check('pre: B-C directly overlapped', r.preBC === true);
    check('pre: A-C NOT directly overlapped', r.preAC === false);
    check('isOverlappedThrough exists', r.hasThrough === true);
    check('A-C overlapped THROUGH B (the clause)', r.throughAC === true);
    check('evaluate(A,C) applies Rule 11 (not 12)', r.rule3 === 'Rule 11', 'got ' + r.rule3);
    check('control: B parked -> through false', r.throughNoB === false);
    check('control: B parked -> Rule 12', r.ruleNoB === 'Rule 12', 'got ' + r.ruleNoB);
    check('pre: far-abeam B overlaps A', r.preAbeamBA === true);
    check('pre: far-abeam B overlaps C', r.preAbeamBC === true);
    check('control: far-abeam B is not BETWEEN -> no chain', r.throughAbeam === false);
    check('control: far-abeam B -> Rule 12 stands', r.ruleAbeam === 'Rule 12', 'got ' + r.ruleAbeam);
    check('finished boats never intervene', r.throughFin === false);
    if (errs.length) check('no page errors', false, errs[0]);
    console.log(fails ? `${fails} FAILURES` : 'ALL OK');
    await browser.close();
    process.exit(fails ? 1 : 0);
})();
