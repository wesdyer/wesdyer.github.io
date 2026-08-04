// Mark kinds: what a committee boat is, and how it is laid out.
//
//   node regatta/eval/test_marks.js
//
// A buoy is a 24-unit circle with no "up". A committee boat is a vessel: it has a
// heading taken from the line it defines, a hull that collides, and it sits outboard
// of the line so the line's sailable span stays clear. The properties worth pinning:
//
//   - the bow points the way the fleet STARTS, derived from the line's own normal
//   - that heading is FROZEN at first use, so a line sailed twice does not spin the
//     boat 180 degrees when the fleet comes back to finish
//   - the hull is nudged outboard, away from the far end of the line
//   - a plain buoy is untouched — same heading (none), same position, same 12-unit
//     body it always had, because every mark consumer is written as (const + bodyR)
const { chromium } = require('playwright');
const path = require('path');

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.resolve('regatta/index.html'));

    const r = await page.evaluate(() => {
        // Open water. Wind such that up-course is -y: the start line sits at y=+2000 and
        // the fleet beats away to the gate at y=-1000. Travel through the start is (0,-1),
        // so the STARBOARD end — right hand of travel — is the one at +x.
        const mk = (boatEnd) => ({
            schema: 1, venue: 'marktest',
            world: { size: 9000, boundary: { poly: [[-4500,-4500],[4500,-4500],[4500,4500],[-4500,4500]], circle: null } },
            land: [{ id: 'far', cls: 'granite', style: 'granite', soft: false, c: [4100, 4100], r: 150,
                     outer: [[4000,4000],[4200,4000],[4200,4200],[4000,4200]], holes: [] }],
            course: {
                legs: 2,
                marks: [
                    { id: 'sf-pin',  x: -550, y: 2000, kind: boatEnd === 'pin' ? 'committee' : 'inflatable' },
                    { id: 'sf-boat', x:  550, y: 2000, kind: boatEnd === 'pin' ? 'inflatable' : 'committee' },
                    { id: 'gate-a',  x: -400, y: -1000, kind: 'inflatable' },
                    { id: 'gate-b',  x:  400, y: -1000, kind: 'inflatable' }
                ],
                route: [
                    { kind: 'line', marks: [0, 1], dir: 1,  role: 'start' },
                    { kind: 'gate', marks: [2, 3], dir: 1,  role: 'gate' },
                    { kind: 'line', marks: [0, 1], dir: -1, role: 'finish', finish: true }
                ]
            },
            wind: { mode: 'fixed', baseDirection: 0 },
            seeded: {}
        });
        VENUES.marktest = { name: 'Mark Test', label: 'MT', emoji: '⛴️', fx: { mask: true } };

        const race = (boatEnd) => {
            window.VENUE_DOC.marktest = mk(boatEnd);
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'marktest' }));
            let s = 4242;
            Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace();
            return state.course.marks.map(m => ({
                id: m.id, kind: m.kind, x: m.x, y: m.y,
                heading: m.heading, drawX: m.drawX, drawY: m.drawY,
                bodyR: m.bodyR, body: m.body
            }));
        };

        const starboard = race('boat');
        const port = race('pin');
        // Validate a MIGRATED document — index-form route entries are the legacy shape,
        // and every real caller (initCourse, the editor) migrates before validating.
        const warnFor = (end) => window.VenueDoc.validate(window.VenueDoc.migrate(mk(end)))
            .filter(p => /starboard end/.test(p.msg))
            .map(p => p.level + ': ' + p.msg);
        return { starboard, port, warnStarboard: warnFor('boat'), warnPort: warnFor('pin'), errs: [] };
    });

    const boat = r.starboard[1], pin = r.starboard[0], gateA = r.starboard[2];

    console.log('\ncommittee boat: a vessel, oriented by its line');
    // Travel through the start is (0,-1) — dead up the screen — so the bow bears 0.
    check('bow points the way the fleet starts', near(boat.heading, 0, 1e-6),
          `heading ${boat.heading}`);
    // Outboard along the line, AWAY from the pin at -x, by half a beam.
    check('hull sits outboard of the line, clear of the span',
          near(boat.drawX, 569, 1e-6) && near(boat.drawY, 2000, 1e-6),
          `draw (${boat.drawX}, ${boat.drawY})`);
    check('the mark POINT itself is untouched', boat.x === 550 && boat.y === 2000,
          `(${boat.x}, ${boat.y})`);
    check('hull is a 3-circle capsule down the centreline',
          Array.isArray(boat.body) && boat.body.length === 3 &&
          boat.body.every(c => c.r === 19 && near(c.x, 569, 1e-6)),
          JSON.stringify(boat.body));
    check('body radius grows past a buoy\'s 12', boat.bodyR > 45 && boat.bodyR < 50,
          `bodyR ${boat.bodyR}`);

    console.log('\na plain buoy is left exactly as it was');
    for (const m of [pin, gateA]) {
        check(`${m.id}: no heading, no offset, 12-unit body`,
              m.heading === null && m.drawX === m.x && m.drawY === m.y &&
              m.body === null && m.bodyR === 12,
              JSON.stringify(m));
    }

    console.log('\nthe heading is frozen at FIRST use, not re-derived per leg');
    // This line is sailed twice — up through it at the start, down through it at the
    // finish. Re-deriving would flip the bow; a boat at anchor does not turn around.
    check('a line used twice keeps one heading', near(boat.heading, 0, 1e-6),
          `heading ${boat.heading} (a per-leg derivation would give ~${Math.PI})`);

    console.log('\nthe starboard-end convention is checked, not enforced');
    check('starboard end passes quietly', r.warnStarboard.length === 0,
          JSON.stringify(r.warnStarboard));
    check('port end warns', r.warnPort.length === 1 && r.warnPort[0].startsWith('warn:'),
          JSON.stringify(r.warnPort));

    check('no page errors', errs.length === 0, errs.join(' | '));

    await browser.close();
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exit(failures ? 1 : 0);
})();
