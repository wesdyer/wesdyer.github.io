// THE FLEET STARTS BEHIND THE START LINE.
//
// Three ways that has broken, one of them shipped:
//
// 1. `selectVenue()` rebuilds the course with initCourse() — new marks, new wind — but
//    used not to re-place the fleet, and `startRace()` only flips the status flag. So the
//    race began with every boat still sitting behind the PREVIOUS venue's line. It only
//    showed when the two venues disagreed about the course axis, which is why it read as
//    an intermittent "sometimes the whole fleet is dropped somewhere odd".
//
// 2. Ten call sites read `marks[0]`/`marks[1]` as "the start line". Marks carry IDS and
//    the route names them by id, so the editor is free to author a document whose marks
//    array is in any order — and then index 0/1 is whatever happens to be first. The
//    reorder case below is the one that protects venue authoring: it puts the WINDWARD
//    gate at indices 0/1, which used to spawn the fleet 4000 units up the course.
//
// 3. Spawning outside the arena, where the containment clamp would drag the fleet to the
//    rim. Checked here too since it is the same "where did everyone go" symptom.
//
// ⚠️ `resetGame()` calls `loadSettings()` as its FIRST act, so `settings.venue = x;
// resetGame()` does NOT race venue x — the assignment is overwritten from localStorage
// before the course is built. Every venue must be selected by writing localStorage. A
// probe that got this wrong measured one venue ten times and reported ten identical
// passes, which is exactly what a broken venue would also look like.
const { chromium } = require('playwright');
const path = require('path');

let bad = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const fail = (m) => { bad++; console.log(`  FAIL  ${m}`); };

// Spawn is a lane layout: every boat sits a fixed distance BACK from the line, spread
// along it. So "behind the line" means the perpendicular offset is near that distance and
// the lateral offset is within the line's own length.
const MEASURE = () => {
    const c = state.course;
    const sm = (c.route && c.route[0] && c.route[0].marks) || [0, 1];
    const A = c.marks[sm[0]], B = c.marks[sm[1]];
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    let lx = B.x - A.x, ly = B.y - A.y;
    const L = Math.hypot(lx, ly); lx /= L; ly /= L;
    let maxPerp = 0, maxAlong = 0, outside = 0;
    for (const bt of state.boats) {
        const dx = bt.x - mx, dy = bt.y - my;
        maxPerp = Math.max(maxPerp, Math.abs(dx * -ly + dy * lx));
        maxAlong = Math.max(maxAlong, Math.abs(dx * lx + dy * ly));
        if (Arena.signedDist(c.boundary, bt.x, bt.y) <= 0) outside++;
    }
    return { maxPerp: Math.round(maxPerp), maxAlong: Math.round(maxAlong), outside, lineLen: Math.round(L) };
};

(async () => {
    const b = await chromium.launch();
    const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.VENUE_DOC && window.Arena);
    await p.evaluate(m => { window.__measure = eval('(' + m + ')'); }, MEASURE.toString());

    const venues = await p.evaluate(() => Object.keys(window.VENUE_DOC));

    console.log('the fleet spawns behind the start line, in every venue\n');
    {
        const r = await p.evaluate((vs) => {
            const out = [];
            for (const v of vs) {
                localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
                resetGame();
                out.push({ v, actual: settings.venue, ...window.__measure() });
            }
            return out;
        }, venues);
        const wrong = r.filter(x => x.actual !== x.v);
        if (wrong.length) fail(`venue selection did not take for ${wrong.length} venue(s) — the check below would be meaningless`);
        else ok('all 10 venues actually loaded');
        const bads = r.filter(x => x.maxPerp > 900 || x.maxAlong > x.lineLen || x.outside);
        if (bads.length) fail('some venue spawns off the line: ' + JSON.stringify(bads.slice(0, 3)));
        else ok(`all ${r.length} venues: fleet within ${Math.max(...r.map(x => x.maxPerp))}u behind the line, none outside the arena`);
        // Guards the loadSettings trap above: if venue selection silently stopped working,
        // every row would be one venue and this collapses to 1. Wind is randomized per race
        // so the exact count moves run to run; only "more than one" is meaningful.
        const spread = new Set(r.map(x => x.lineLen + ':' + x.maxAlong)).size;
        if (spread < 2) fail('every venue measured identically — venue selection is not taking');
        else ok(`${spread} distinct start-line geometries across the ten venues`);
    }

    console.log('\nswitching venue re-places the fleet (the intermittent bug)');
    {
        const r = await p.evaluate((vs) => {
            const out = [];
            for (const from of vs) for (const to of vs) {
                if (from === to) continue;
                localStorage.setItem('regatta_settings', JSON.stringify({ venue: from }));
                resetGame();
                state.race.status = 'waiting';
                selectVenue(to);
                const m = window.__measure();
                if (m.maxPerp > 900 || m.outside) out.push({ from, to, ...m });
            }
            return { n: vs.length * (vs.length - 1), bad: out };
        }, venues);
        if (r.bad.length) fail(`${r.bad.length}/${r.n} switches strand the fleet: ` + JSON.stringify(r.bad.slice(0, 3)));
        else ok(`all ${r.n} venue switches leave the fleet behind the NEW line`);
    }

    console.log('\na document whose marks array is reordered still starts correctly');
    {
        // The editor names marks by id, so it may emit them in any order. Put the windward
        // gate first: `marks[0]/[1]` now IS the windward gate, 4000 units up the course.
        const r = await p.evaluate(() => {
            const doc = JSON.parse(JSON.stringify(window.VENUE_DOC.seatrials));
            const m = doc.course.marks;
            doc.course.marks = [m[2], m[3], m[0], m[1]];
            window.VENUE_DOC.__reorder = Object.assign(doc, { venue: '__reorder' });
            VENUES.__reorder = Object.assign({}, VENUES.seatrials, { key: '__reorder' });
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: '__reorder' }));
            resetGame();
            const c = state.course;
            const sm = (c.route && c.route[0] && c.route[0].marks) || [0, 1];
            return { startIdx: sm, marksOrder: c.marks.map(x => x.id || x.name), ...window.__measure() };
        });
        if (r.startIdx[0] === 0 && r.startIdx[1] === 1) {
            fail('the reorder did not take — route[0] still points at indices 0/1, so this proves nothing');
        } else if (r.maxPerp > 900 || r.maxAlong > r.lineLen) {
            fail(`fleet spawned off the reordered start line (perp ${r.maxPerp}, along ${r.maxAlong}/${r.lineLen}) — a start-line site is still reading marks[0]/[1]`);
        } else {
            ok(`route[0] resolves to marks [${r.startIdx}] and the fleet is ${r.maxPerp}u behind THAT line`);
        }
    }

    if (errs.length) fail('page errors: ' + errs.slice(0, 2).join(' | '));
    else ok('no page errors');

    console.log(`\n${bad ? 'FAIL' : 'PASS'} — ${bad} failure(s)`);
    await b.close();
    process.exitCode = bad ? 1 : 0;
})();
