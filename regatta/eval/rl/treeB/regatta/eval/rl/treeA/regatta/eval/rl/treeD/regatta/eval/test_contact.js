// CONTACT: what counts as crossing a line, what counts as hitting land, and what a
// collision costs.
//
// Three rules, all of them about the boat's real SHAPE rather than its centre point:
//
//   1. A line is crossed when ANY PART OF THE HULL crosses it (RRS definitions of Start
//      and Finish, and RRS 28). Sweeping the centre finished you half a boat-length late.
//   2. Land is hit when the HULL touches it. The mask path used one circle of radius 30
//      about the centre — twice the boat's actual half-beam — so a berg could be struck
//      from most of a boat-width clear.
//   3. Running aground costs SPEED, never a penalty turn. Land is not a mark: RRS 31 is
//      about marks and the rest of Part 2 is boat-on-boat. The only penalty an obstruction
//      can produce is Rule 19 against the boat that denied room.
const { chromium } = require('playwright');
const path = require('path');

let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(2500);

    const r = await page.evaluate(() => {
        const o = {};
        const boat = state.boats[0];

        // ── 1. THE HULL CROSSES THE LINE, NOT THE CENTRE ────────────────────
        // A line dead ahead of the boat, placed between the bow and the centre: the bow is
        // past it, the centre is not. Stepping the boat forward by a hair must register.
        const place = (x, y, heading) => {
            boat.x = x; boat.y = y; boat.heading = heading;
            boat.raceState.lastPos = { x, y };
        };
        // Heading 0 = north = -y, so the bow is 25 units toward -y.
        place(0, 0, 0);
        // The bow tip sits at y = -25. Put the line a half unit beyond it and creep forward
        // one unit: the BOW sweeps across, the centre (0 -> -1) comes nowhere near.
        const lineY = -25.5;
        boat.y = -1;
        o.hullCrosses = hullCrossedLine(boat, -500, lineY, 500, lineY);
        // The old test, for contrast: the centre track over the same step.
        o.centreMisses = !checkLineIntersection(boat.raceState.lastPos.x, boat.raceState.lastPos.y,
                                                boat.x, boat.y, -500, lineY, 500, lineY);
        // ...and a line the whole boat is still short of registers nothing.
        place(0, 0, 0);
        boat.y = -1;
        o.noFalseCross = !hullCrossedLine(boat, -500, -80, 500, -80);
        // Beam-on, the boat is only 15 wide each side, so a line 20 abeam is NOT crossed.
        place(0, 0, Math.PI / 2);                // heading east: bow toward +x
        boat.x = 1;
        o.beamNoCross = !hullCrossedLine(boat, 0, 20, 500, 20);

        // ...and it fires ONCE per passage, not on every frame the hull straddles the line.
        // A 55-unit boat takes many frames to clear a line; a naive "any vertex touched it"
        // test fires on all of them and advanced two legs in one pass.
        place(0, 200, 0);
        let fires = 0;
        for (let i = 0; i < 400; i++) {
            boat.raceState.lastPos = { x: boat.x, y: boat.y };
            boat.y -= 1;                                   // creep north across y = 0
            if (hullCrossedLine(boat, -500, 0, 500, 0)) fires++;
        }
        o.firesOncePerPassage = fires === 1;
        o.fireCount = fires;

        // ── 2. THE HULL HITS LAND, NOT A 30-UNIT BUBBLE ─────────────────────
        // A big straight-edged landmass with its shore along x = 0, water to the left.
        const shore = [{ x: 0, y: -4000 }, { x: 4000, y: -4000 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }];
        // Sailing north (heading 0) with the shore abeam to starboard. Half-beam is 15.
        const abeamHit = (gap) => {
            boat.x = -gap; boat.y = 0; boat.heading = 0;
            return !!hullPolyCollide(boat, shore);
        };
        o.hitsWhenTouching = abeamHit(12);        // hull overlaps the shore
        o.clearAt20 = !abeamHit(20);              // 5 units of water — must be clear
        o.clearAt25 = !abeamHit(25);
        // The old collider for comparison: one disc of radius 30 about the centre.
        o.oldFalselyHitAt20 = !!circlePolyCollide(-20, 0, 30, shore);
        o.oldFalselyHitAt25 = !!circlePolyCollide(-25, 0, 30, shore);
        // Bow-on, the boat really is ~27 long, so it must still strike.
        boat.x = -20; boat.y = 0; boat.heading = Math.PI / 2;   // pointing at the shore
        o.bowOnHits = !!hullPolyCollide(boat, shore);

        // ── 3. AGROUND COSTS SPEED, NOT A PENALTY ───────────────────────────
        settings.penaltiesEnabled = true;
        state.race.status = 'racing';
        const isl = { x: 2000, y: 0, radius: 4000, fromMask: true, soft: false,
                      vertices: shore.map(p => ({ x: p.x, y: p.y })) };
        const saveIsl = state.course.islands;
        state.course.islands = [isl];
        for (const b of state.boats) { b.x = -100000; b.y = -100000; }   // everyone else far away
        const victim = state.boats[0];
        victim.raceState.penalty = false;
        victim.raceState.totalPenalties = 0;
        victim.x = -5; victim.y = 0; victim.heading = 0;                 // hard aground
        victim.speed = 1.0;
        checkIslandCollisions(1 / 60);
        o.groundedNoPenalty = victim.raceState.penalty === false && victim.raceState.totalPenalties === 0;
        o.groundedLostSpeed = victim.speed < 0.5;
        o.groundedPushedOut = victim.x < -5;
        state.course.islands = saveIsl;

        // Touching a MARK is still a penalty — the rule that really exists.
        o.markRuleStillCited = String(updateBoatRaceState).includes('Rule 31')
                            || String(window.__srcHasRule31 || '') !== '';
        return o;
    });

    console.log('\ncrossing a line');
    check('the BOW crossing the line counts', r.hullCrosses === true);
    check('...and the centre-only test would have missed it', r.centreMisses === true);
    check('a line the whole boat is short of is not crossed', r.noFalseCross === true);
    check('a line 20 units abeam is not crossed — the boat is 15 half-beam', r.beamNoCross === true);
    check('...and one passage fires exactly one crossing, not one per frame',
          r.firesOncePerPassage === true, `${r.fireCount} fires`);

    console.log('\nhitting land');
    check('a hull overlapping the shore collides', r.hitsWhenTouching === true);
    check('5 units of clear water abeam is NOT a collision', r.clearAt20 === true);
    check('...nor is 10 units', r.clearAt25 === true);
    check('...and the old 30-unit bubble DID falsely collide at both',
          r.oldFalselyHitAt20 === true && r.oldFalselyHitAt25 === true);
    check('bow-on, the boat is long enough to still strike', r.bowOnHits === true);

    console.log('\nwhat a grounding costs');
    check('running aground gives NO penalty — land is not a mark', r.groundedNoPenalty === true);
    check('...it costs speed instead', r.groundedLostSpeed === true);
    check('...and pushes the boat clear', r.groundedPushedOut === true);

    check('no page errors', errs.length === 0, errs[0]);
    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)`);
    await browser.close();
    process.exit(fails ? 1 : 0);
})();
