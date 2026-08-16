// RULE 15 ORACLE SCENARIOS (2026-08-15, the constraints-wiring work).
// test_markroom's pattern: boats placed by hand, Rules.update() stepped with a
// hand-advanced clock, getRightOfWay() read. No races, no physics. Every case
// asserts its own PRECONDITIONS first (the markroom lesson: two versions once
// passed on a broken engine because the setup was not what it claimed).
//
// Cases:
//  1. ACQUISITION: A starboard ROW over B (port, rule 10). B tacks onto
//     starboard to leeward -> B becomes ROW (rule 11) BY HER OWN ACTION ->
//     "Rule 15" constraint on for <2 s, gone after.
//  2. EXCEPTION: A starboard ROW over B (port). A tacks onto port while B
//     holds -> B becomes ROW because of A'S action -> NO constraint.
//  3. FIRST MEETING: a fresh pair's first evaluation names a ROW boat ->
//     NO constraint (a meeting is not an acquisition).
//   node _r15_oracle.js <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeR15');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), 'seatrials');
    const out = await p.evaluate(() => {
        window.evalHarness.seed = 1; window.resetGame();
        const L = [];
        const mk = (id, x, y, heading) => ({
            id, name: 'S' + id, x, y, heading, boomSide: 0,
            raceState: { finished: false, ocs: false, penalty: false, isTacking: false, leg: 1 }
        });
        const wd = getWindAt(0, 0).direction;
        // starboard close-hauled: twa = heading - wd must be NEGATIVE (~ -38°)
        const stbdCH = normalizeAngle(wd - 0.66);
        const portCH = normalizeAngle(wd + 0.66);
        const step = (dt) => { state.time += dt; window.Rules.update(dt); };
        const fresh = (A, B) => { window.Rules.init(); state.boats = [A, B]; state.time = 100; };

        // ── Case 1: acquisition by own action ───────────────────────────
        // A starboard; B port, well separated (no overlap question yet).
        const A = mk(1, 0, 0, stbdCH), B = mk(2, -200, 150, portCH);
        fresh(A, B);
        step(0.1); step(0.1);
        let r = window.Rules.getRightOfWay(A, B);
        L.push(['1-pre: rule', r.rule, 'row', r.boat && r.boat.name]);
        const pre1 = r.rule === 'Rule 10' && r.boat === A
            && (!r.constraints || r.constraints.indexOf('Rule 15') === -1);
        L.push(['1-pre asserts (Rule 10, A row, no r15 on first meeting):', pre1 ? 'OK' : 'FAIL']);
        // B tacks: flip to starboard, positioned clear-ahead-to-leeward of A.
        B.heading = stbdCH; B.x = -80; B.y = 60;
        step(0.1);
        r = window.Rules.getRightOfWay(A, B);
        const overlapped = window.Rules.isOverlapped(A, B);
        const leew = window.Rules.getLeewardBoat(A, B);
        L.push(['1-post: rule', r.rule, 'row', r.boat && r.boat.name, 'overlap', overlapped, 'leeward', leew.name, 'constraints', JSON.stringify(r.constraints)]);
        const pre1b = overlapped && leew === B && r.boat === B;
        L.push(['1-post asserts (overlapped, B leeward, B row):', pre1b ? 'OK' : 'FAIL']);
        const c1 = r.constraints && r.constraints.indexOf('Rule 15') !== -1;
        L.push(['1-VERDICT r15 active just after acquisition:', c1 ? 'OK' : 'FAIL']);
        // expiry: advance past 2 s
        for (let i = 0; i < 25; i++) step(0.1);
        r = window.Rules.getRightOfWay(A, B);
        const c1e = !(r.constraints && r.constraints.indexOf('Rule 15') !== -1);
        L.push(['1-VERDICT r15 expired after 2.5s:', c1e ? 'OK' : 'FAIL']);

        // ── Case 2: exception — loser's own action ──────────────────────
        const A2 = mk(3, 0, 0, stbdCH), B2 = mk(4, -200, 150, portCH);
        fresh(A2, B2);
        step(0.1); step(0.1);
        r = window.Rules.getRightOfWay(A2, B2);
        // burn in ownership: A2 is rowOwner now (rule 10)
        const pre2 = r.rule === 'Rule 10' && r.boat === A2;
        L.push(['2-pre asserts (A2 row under Rule 10):', pre2 ? 'OK' : 'FAIL']);
        step(0.1);
        // A2 tacks onto PORT (her own action); B2 holds port -> same tack,
        // or make it clean: A2 flips to port and sits clear astern; B2 ahead.
        A2.heading = portCH; A2.x = -350, A2.y = 300;
        step(0.1);
        r = window.Rules.getRightOfWay(A2, B2);
        L.push(['2-post: rule', r.rule, 'row', r.boat && r.boat.name, 'constraints', JSON.stringify(r.constraints)]);
        const pre2b = r.boat === B2;
        L.push(['2-post asserts (B2 now row):', pre2b ? 'OK' : 'FAIL']);
        const c2 = !(r.constraints && r.constraints.indexOf('Rule 15') !== -1);
        L.push(['2-VERDICT no r15 when ROW came from the LOSER own tack:', c2 ? 'OK' : 'FAIL']);

        return L;
    });
    for (const l of out) console.log(l.join(' '));
    await b.close();
})();
