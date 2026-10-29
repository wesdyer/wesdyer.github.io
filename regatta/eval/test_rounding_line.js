// THE ROUNDING LINE, AUTHORED AND HELD (Oct 26 2026, Wes).
//
// Every rounding has a line: a ray from the mark that, crossed the required way, rounds it
// (PT-081, sim/physics.js roundingLine). Wes's rework:
//   * the line runs to INFINITY (it stopped at the nearer of the previous and next marks),
//   * a leg may carry an authored `lineBrg` (compass degrees from the mark) that overrides the
//     automatic bisector — the editor draws every line and drags this one,
//   * the race never draws it, but the HUD keeps a just-rounded mark's ring up until the hull
//     leaves its zone (`boat._roundExit`, hud.js shownRoundings), so the player sees it through.
//   * "crossed" is counted as WINDING from where the leg began, so a crossing far behind the
//     previous mark is not a rounding of this one, and a true hairpin's line is its far side.
// This suite proves each, at every rounding of Bay (which rounds two marks twice), plus the
// validator rule and that the editor draws the race's own line.
//
// node regatta/eval/test_rounding_line.js
const { chromium } = require('playwright');
const path = require('path');

let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    const errs = [];
    console.log('\nTHE ROUNDING LINE — authored, infinite, held on the HUD\n');

    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', e => errs.push('game: ' + e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);
    const res = await page.evaluate(() => {
        window.requestAnimationFrame = () => 0;   // only this script moves anything
        window.resetGame(); window.startRace();
        const route = state.course.route, marks = state.course.marks, out = { legs: [] };
        // roundingStep along a synthetic track: in from the previous mark to radius R, round
        // through the turn (400 steps), on to the next mark. The arc step credit landed on, or -1.
        const legGeom = (L) => {
            const rm = route[L].mark, sgn = rm.side === 'port' ? -1 : 1;
            const prevA = CoursePath.anchor(route[L - 1], marks), nextA = CoursePath.anchor(route[L + 1], marks);
            const aS = Math.atan2(prevA.y - rm.y, prevA.x - rm.x), aN = Math.atan2(nextA.y - rm.y, nextA.x - rm.x);
            let arc = (aN - aS) * sgn;
            while (arc <= 0) arc += 2 * Math.PI;
            while (arc > 2 * Math.PI) arc -= 2 * Math.PI;
            if (arc < 0.35) arc += 2 * Math.PI;
            return { rm, sgn, prevA, nextA, aS, arc };
        };
        const run = (L, R) => {
            const { rm, sgn, prevA, nextA, aS, arc } = legGeom(L);
            const pts = [], D0 = Math.hypot(prevA.x - rm.x, prevA.y - rm.y);
            for (let k = 0; k <= 60; k++) { const d = D0 + (R - D0) * k / 60; pts.push([rm.x + Math.cos(aS) * d, rm.y + Math.sin(aS) * d]); }
            for (let k = 1; k <= 400; k++) { const a = aS + sgn * arc * k / 400; pts.push([rm.x + Math.cos(a) * R, rm.y + Math.sin(a) * R]); }
            const [ex, ey] = pts[pts.length - 1];
            for (let k = 1; k <= 300; k++) pts.push([ex + (nextA.x - ex) * k / 300, ey + (nextA.y - ey) * k / 300]);
            const rs = { leg: L, lastPos: { x: pts[0][0], y: pts[0][1] }, roundSweep: 0, roundWrong: 0 };
            for (let i = 1; i < pts.length; i++) {
                const [x, y] = pts[i];
                if (roundingStep({ x, y, heading: 0 }, rs, rm, nextA).done) return i - 61;
                rs.lastPos = { x, y };
            }
            return -1;
        };
        for (let L = 1; L < route.length - 1; L++) {
            const e = route[L];
            if (!e || e.kind !== 'round' || !e.mark) continue;
            const g = legGeom(L), rm = g.rm, z = rm.zone;
            const auto = run(L, z * 0.8);
            // AUTHORED: a line three quarters of the way round must move the credit there.
            const a75 = g.aS + g.sgn * g.arc * 0.75;   // math angle, y down
            rm.lineBrg = ((Math.atan2(Math.cos(a75), -Math.sin(a75)) * 180 / Math.PI) % 360 + 360) % 360;
            const authored = run(L, z * 0.8);
            delete rm.lineBrg;
            // INFINITE: a rounding far beyond both neighbouring marks (where the old line stopped).
            const far = 3 * Math.max(Math.hypot(g.prevA.x - rm.x, g.prevA.y - rm.y), Math.hypot(g.nextA.x - rm.x, g.nextA.y - rm.y));
            // a TRUE HAIRPIN (back to the mark she came from): the line is the far side, away from it
            let farSide = null;
            if (Math.hypot(g.prevA.x - g.nextA.x, g.prevA.y - g.nextA.y) < 1) {
                const ln = roundingLine(rm, g.nextA, null, L);
                farSide = ln.ux * (g.prevA.x - rm.x) + ln.uy * (g.prevA.y - rm.y) < 0;
            }
            out.legs.push({ L, side: rm.side, auto, authored, farR: Math.round(far), farStep: run(L, far), farSide });
        }

        // THE HUD HOLD: the player's real leg engine, driven step by step round route[1].
        const boat = state.boats.find(b => b.isPlayer);
        for (const b of state.boats) if (b !== boat) { b.x = 1e6; b.y = 1e6; b.speed = 0; }
        while (state.race.status === 'prestart') update(1 / 60);
        const L = 1, g = legGeom(L), rm = g.rm, R = rm.zone * 0.6;
        const track = [];
        for (let k = 0; k <= 40; k++) { const d = rm.zone * 3 + (R - rm.zone * 3) * k / 40; track.push([rm.x + Math.cos(g.aS) * d, rm.y + Math.sin(g.aS) * d]); }
        for (let k = 1; k <= 400; k++) { const a = g.aS + g.sgn * g.arc * k / 400; track.push([rm.x + Math.cos(a) * R, rm.y + Math.sin(a) * R]); }
        const [ex, ey] = track[track.length - 1];
        for (let k = 1; k <= 200; k++) track.push([ex + (g.nextA.x - ex) * k / 200, ey + (g.nextA.y - ey) * k / 200]);
        const rs = boat.raceState;
        rs.leg = L; rs.finished = false; rs._rlMark = null; rs.roundSweep = 0; rs.roundWrong = 0; rs.roundArmed = false;
        boat._roundExit = null;
        boat.x = track[0][0]; boat.y = track[0][1]; rs.lastPos = { x: boat.x, y: boat.y };
        const h = { creditedAt: -1, heldAtCredit: false, shownAtCredit: 0, clearedAt: -1, clearedOutside: false, heldInside: true };
        for (let i = 1; i < track.length; i++) {
            rs.lastPos = { x: boat.x, y: boat.y };
            boat.x = track[i][0]; boat.y = track[i][1];
            boat.heading = Math.atan2(boat.x - rs.lastPos.x, -(boat.y - rs.lastPos.y));
            updateBoatRaceState(boat, 1 / 60);
            const d = Math.hypot(boat.x - rm.x, boat.y - rm.y);
            if (h.creditedAt < 0 && rs.leg > L) {
                h.creditedAt = i;
                h.heldAtCredit = !!(boat._roundExit && boat._roundExit.mark === rm && boat._roundExit.leg === L);
                h.shownAtCredit = shownRoundings(boat).length;
            } else if (h.creditedAt >= 0 && h.clearedAt < 0) {
                if (!boat._roundExit) { h.clearedAt = i; h.clearedOutside = d > rm.zone - 30; }
                else if (d > rm.zone + 40) h.heldInside = false;   // still held well outside the zone
            }
        }
        out.hold = h;
        // the HUD draws with a held mark without throwing
        try { const c = document.createElement('canvas').getContext('2d'); boat._roundExit = { mark: rm, leg: L }; drawMarkZones(c); drawRoundingArrows(c); boat._roundExit = null; out.drawOk = true; }
        catch (e) { out.drawOk = e.message; }

        // THE VALIDATOR: a bearing out of range is an error; a good one is not.
        const doc = JSON.parse(JSON.stringify(window.VENUE_DOC.bay));
        const ri = doc.course.route.findIndex(e => e.kind === 'round');
        const errsFor = (v) => { doc.course.route[ri].lineBrg = v; return VenueDoc.validate(doc).filter(p => p.level === 'error' && /lineBrg/.test(p.msg)).length; };
        out.valid = { good: errsFor(135), bad: errsFor(400), str: errsFor('90') };
        return out;
    });
    await page.close();

    for (const m of res.legs) {
        const tag = `bay leg ${m.L} (${m.side})`;
        check(`${tag}: the automatic line credits the rounding`, m.auto >= 0, 'never credited');
        check(`${tag}: an authored line 3/4 round moves the credit there`, m.authored >= 0 && Math.abs(m.authored - 300) <= 6,
              m.authored < 0 ? 'never credited' : `credited at step ${m.authored} of 400 (auto ${m.auto})`);
        if (m.farSide !== null) check(`${tag}: a hairpin's line is the far side, away from the mark she came from`, m.farSide);
        check(`${tag}: the line reaches past both neighbours (rounding at ${m.farR} u still counts)`, m.farStep >= 0, 'never credited');
    }
    check('Bay rounds at least four marks', res.legs.length >= 4, `${res.legs.length}`);
    check('Bay has a true hairpin to test', res.legs.some(m => m.farSide !== null));
    const h = res.hold;
    check('HUD: the player is credited round leg 1', h.creditedAt >= 0, 'never credited');
    check('HUD: at credit the rounded mark is held, beside the next', h.heldAtCredit && h.shownAtCredit >= 1,
          `held ${h.heldAtCredit}, ${h.shownAtCredit} shown`);
    check('HUD: the hold clears when the hull leaves the zone, not before', h.clearedAt > 0 && h.clearedOutside && h.heldInside,
          `cleared at ${h.clearedAt}, outside ${h.clearedOutside}, never held far out ${h.heldInside}`);
    check('HUD: the ring and arrows draw for a held mark', res.drawOk === true, String(res.drawOk));
    check('validator: lineBrg 135 is fine', res.valid.good === 0);
    check('validator: lineBrg 400 is an error', res.valid.bad === 1);
    check('validator: lineBrg as a string is an error', res.valid.str === 1);

    // THE EDITOR draws the race's own line, and a typed bearing reaches the compiled course.
    const ed = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    ed.on('pageerror', e => errs.push('editor: ' + e.message));
    await ed.goto('file://' + path.resolve('regatta/editor.html'));
    await ed.waitForTimeout(900);
    await ed.evaluate(() => window.EditorApp.loadVenue('bay'));
    await ed.waitForTimeout(900);
    const er = await ed.evaluate(() => {
        const route = window.EditorApp._state().doc.course.route;
        const li = route.findIndex(e => e.kind === 'round');
        const A = window.EditorApp, roundLineOf = A._roundLineOf, setLegLine = A._setLegLine;
        const auto = roundLineOf(li);
        setLegLine(li, 200.4);
        const set = roundLineOf(li);
        setLegLine(li, null);
        const back = roundLineOf(li);
        return { li, auto, set, back, docBack: route[li].lineBrg };
    });
    await ed.close();
    check('editor: a rounding line exists for the first rounding', !!er.auto && !er.auto.authored, JSON.stringify(er.auto));
    check('editor: a typed bearing is the line (rounded to a degree)', er.set && er.set.authored && Math.abs(er.set.brg - 200) < 0.01, JSON.stringify(er.set));
    check('editor: back to automatic restores the bisector', er.back && !er.back.authored && Math.abs(er.back.brg - er.auto.brg) < 0.01 && er.docBack === undefined,
          JSON.stringify(er.back));

    if (errs.length) check('no page errors', false, errs[0]); else check('no page errors', true);
    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)\n`);
    await browser.close();
    process.exit(fails ? 1 : 0);
})();
