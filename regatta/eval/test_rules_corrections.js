// RULES CORRECTIONS (2026-10-28) — the six engine bugs a review of the Sailing Kiwi rules videos found
// (issues file PT-111), one case each plus a control, at the oracle and umpire layers:
//
//   1. RRS 15's windows are REAL seconds. They were bare 1.5 / 1.0 / 2.0 against state.time, the world
//      clock at WORLD_CLOCK (0.24) a second — 6.25 / 4.17 / 8.33 s. This harness steps the clock the
//      way the game does; a harness stepping state.time by 1/60 a frame is what hid it.
//   2. RRS 22.1: a boat over early keeps clear only while sailing back towards the pre-start side, and
//      until her WHOLE hull is behind the line — not from the gun, and not only until OCS clears.
//   3. A finished boat is still racing while she is on the line (her fade): a foul there costs +15 s.
//   4. 44.1(a): a mark touched, then a boat fouled in the same incident, is ONE penalty.
//   5. A rounding is not a penalty being taken: inside a zone the turn must pass ~214° to count.
//   6. An ended mark-room entitlement stays ended at that mark (no fresh snapshot after a tack in the
//      zone, or after the entitled boat leaves it).
//
// Batch 2 (2026-10-29):
//   7. RRS 16.1 at contact: a right-of-way boat that turns INTO a boat keeping clear, which her earlier
//      course would have missed, takes the contact penalty (it went to the keep-clear boat).
//   8. RRS 15 from clear astern: a boat that sails into a leeward overlap from clear astern acquires
//      right of way by her own action and owes room initially (Cases 41, 93) — unless the overlap only
//      flickered (the boat ahead had held her rights under 1 s).
//   9. Mark-room is room, not immunity (Case 118): an entitled boat swung out past the boat owing her
//      room is outside mark-room; back inside, she has it again.
//
// Every case asserts its own preconditions. Bay (rounding marks, a start line).
//   node regatta/eval/test_rules_corrections.js
const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || detail == null ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
    await page.goto('file://' + path.join(ROOT, 'index.html'));
    await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

    // Fixture: racing, two bots A and B, everyone else parked off the course (finished and faded out).
    const fx = await page.evaluate(() => {
        window.resetGame(); window.startRace();
        for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
        const bots = state.boats.filter(b => !b.isPlayer);
        const A = bots[0], B = bots[1];
        for (const o of state.boats) if (o !== A && o !== B) { o.x = -1e6; o.y = -1e6; o.raceState.finished = true; o.fadeTimer = 0; }
        let leg = -1, mIdx = -1;
        for (let i = 0; i < state.course.route.length; i++) {
            const e = state.course.route[i];
            if (e && e.kind === 'round' && e.mark) { leg = i; mIdx = state.course.marks.findIndex(m => Math.hypot(m.x - e.mark.x, m.y - e.mark.y) < 1); break; }
        }
        // open water: the point of a coarse grid farthest from every mark
        let far = null, fd = -1;
        for (let x = -3000; x <= 3000; x += 250) for (let y = -3000; y <= 3000; y += 250) {
            const d = Math.min(...state.course.marks.map(m => Math.hypot(m.x - x, m.y - y)));
            if (d > fd) { fd = d; far = { x, y }; }
        }
        // a heading on a given tack, at least 60° off the wind, optionally with a sign along a vector
        const wd = (x, y) => getWindAt(x, y).direction;
        const headingFor = (bt, tack, along, sign) => {
            for (let deg = 0; deg < 360; deg += 5) {
                const h = deg * Math.PI / 180;
                const twa = Math.abs(normalizeAngle(h - wd(bt.x, bt.y)));
                if (twa < 60 * Math.PI / 180 || twa > 150 * Math.PI / 180) continue;
                bt.heading = h;
                if (Rules.getTack(bt) !== (tack === 'starboard' ? 1 : -1)) continue;   // rules.js: STARBOARD = 1, PORT = -1
                if (along && Math.sign(Math.sin(h) * along.x - Math.cos(h) * along.y) !== sign) continue;
                return h;
            }
            return null;
        };
        const reset = (bt, x, y, h) => {
            bt.x = x; bt.y = y; bt.heading = h; bt.speed = 5;
            bt.velocity = { x: Math.sin(h) * 5, y: -Math.cos(h) * 5 };
            const rs = bt.raceState;
            rs.finished = false; rs.ocs = false; rs.penalty = false; rs.penaltyTurnsOwed = 0; rs.penaltyRot = 0;
            rs.totalPenalties = 0; rs.isTacking = false; rs.lastPos = { x, y };
            bt._incidents = {}; bt._lastPenaltyAt = null; bt._penQueue = []; bt._ret22 = false; bt._lineFoul = false;
            bt.fadeTimer = 1;
        };
        window.tackName = (bt) => Rules.getTack(bt) === 1 ? 'starboard' : 'port';
        window.__x = { A, B, leg, mIdx, far, headingFor, reset };
        return { racing: state.race.status === 'racing', leg, mIdx, farD: Math.round(fd), clock: WORLD_CLOCK };
    });
    check('[fixture] bay racing, rounding mark found, open water ≥ 600 u from any mark',
        fx.racing && fx.leg > 0 && fx.mIdx >= 0 && fx.farD >= 600, JSON.stringify(fx));

    // ── 1. RRS 15 in real seconds ─────────────────────────────────────────────────────────────
    const r15 = await page.evaluate(() => {
        const { A, B, far, headingFor, reset } = window.__x;
        Rules.interactions = {};
        const SPS = WORLD_CLOCK;                 // world clock per real second
        // both on port with A holding right of way (B clear astern), so B's tack is an ACQUISITION
        let before = null;
        for (const [dx, dy] of [[-60, 160], [60, 160], [-160, 60], [160, 60], [-160, -60], [160, -60], [60, -160], [-60, -160]]) {
            Rules.interactions = {};
            reset(A, far.x, far.y, 0); reset(B, far.x + dx, far.y + dy, 0);
            const hp = headingFor(A, 'port'); B.heading = hp;
            state.time += SPS / 60; Rules.update(1 / 60);
            before = Rules.evaluate(A, B);
            if (before.rowBoat === A) break;
        }
        // let the setup's own tack flips age out (a flip by the LOSER under 1 s old is the rule's
        // "because of the other boat's actions" exception, and would rightly withhold the grace)
        for (let i = 0; i < 90; i++) { state.time += SPS / 60; Rules.update(1 / 60); }
        before = Rules.evaluate(A, B);
        // B tacks onto starboard
        const hs = headingFor(B, 'starboard');
        const out = { pre: { aTack: tackName(A), rowBefore: before.rowBoat && before.rowBoat.name }, hs };
        const at = (s) => { const r = Rules.evaluate(A, B); return { row: r.rowBoat && r.rowBoat.name, rule: r.rule, r15: r.constraints.indexOf('Rule 15') !== -1 }; };
        state.time += SPS / 60; Rules.update(1 / 60);
        out.t0 = at();
        for (let i = 0; i < 60; i++) { state.time += SPS / 60; Rules.update(1 / 60); }   // +1.0 s
        out.t1 = at();
        for (let i = 0; i < 90; i++) { state.time += SPS / 60; Rules.update(1 / 60); }   // +2.5 s
        out.t25 = at();
        out.B = B.name; out.bTack = tackName(B);
        return out;
    });
    check('[pre] A on port and right of way, then B tacked onto starboard', r15.pre.rowBefore !== r15.B && r15.pre.aTack === 'port' && r15.bTack === 'starboard' && r15.hs != null, JSON.stringify(r15));
    check('RRS 15: B acquires right of way by her own tack — Rule 15 flagged', r15.t0.row === r15.B && r15.t0.r15, JSON.stringify(r15.t0));
    check('RRS 15: still owed 1 s later', r15.t1.r15, JSON.stringify(r15.t1));
    check('RRS 15: expired 2.5 s later (was 8.3 s on the world clock)', !r15.t25.r15 && r15.t25.row === r15.B, JSON.stringify(r15.t25));

    // ── 2. RRS 22.1: returning to start ────────────────────────────────────────────────────────
    const r22 = await page.evaluate(() => {
        const { A, B, headingFor, reset } = window.__x;
        Rules.interactions = {};
        const [m0, m1] = startLinePts(), n = startCrossNormal();
        const mid = { x: (m0.x + m1.x) / 2, y: (m0.y + m1.y) / 2 };
        reset(B, mid.x + n.x * 150, mid.y + n.y * 150, 0); reset(A, mid.x + n.x * 150 + 200, mid.y + n.y * 150, 0);
        B.raceState.leg = 0; A.raceState.leg = 1;
        headingFor(A, 'port');
        const out = {};
        const row = () => { const r = Rules.evaluate(A, B); return { row: r.rowBoat && r.rowBoat.name, rule: r.rule, reason: r.reason }; };
        // over early, still sailing up the course on starboard
        B.raceState.ocs = true; out.awayH = headingFor(B, 'starboard', n, +1);
        Rules.update(1 / 60); out.sailingOn = row();
        // turns back for the line, still starboard
        out.backH = headingFor(B, 'starboard', n, -1);
        Rules.update(1 / 60); out.returning = row();
        // OCS cleared (the line crossed back) but part of her hull still on the course side
        B.raceState.ocs = false;
        B.x = mid.x + n.x * 10; B.y = mid.y + n.y * 10;
        out.offStraddle = Math.round(hullLineOffset(B, m0, m1, true));
        Rules.update(1 / 60); out.straddling = row();
        // whole hull behind the line
        B.x = mid.x - n.x * 80; B.y = mid.y - n.y * 80;
        out.offBehind = Math.round(hullLineOffset(B, m0, m1, true));
        Rules.update(1 / 60); out.behind = row();
        out.A = A.name; out.B = B.name; out.aTack = tackName(A);
        return out;
    });
    check('[pre] A port; B starboard both ways; straddling then behind the line',
        r22.aTack === 'port' && r22.awayH != null && r22.backH != null && r22.offStraddle > 0 && r22.offBehind <= 0, JSON.stringify(r22));
    check('RRS 22.1: over early but still sailing up the course — she keeps her rights (Rule 10)', r22.sailingOn.row === r22.B && r22.sailingOn.rule === 'Rule 10', JSON.stringify(r22.sailingOn));
    check('RRS 22.1: sailing back to the line — she keeps clear', r22.returning.row === r22.A && r22.returning.rule === 'Rule 21', JSON.stringify(r22.returning));
    check('RRS 22.1: OCS cleared but hull still over — she still keeps clear', r22.straddling.row === r22.A && r22.straddling.rule === 'Rule 21', JSON.stringify(r22.straddling));
    check('RRS 22.1: completely behind the line — her rights are back', r22.behind.row === r22.B, JSON.stringify(r22.behind));

    // ── 3. a finished boat on the line ─────────────────────────────────────────────────────────
    const fin = await page.evaluate(() => {
        const { A, B, far, headingFor, reset } = window.__x;
        Rules.interactions = {};
        const out = {};
        const hit = (fade) => {
            reset(A, far.x, far.y, 0); reset(B, far.x + 20, far.y, 0);
            headingFor(A, 'starboard'); headingFor(B, 'port');
            B.raceState.finished = true; B.raceState.finishTime = 200; B.fadeTimer = fade;
            Rules.update(1 / 60);
            window.checkBoatCollisions(1 / 60);
            return { bFinish: B.raceState.finishTime, bPens: B.raceState.totalPenalties, aPen: A.raceState.penalty, aTack: tackName(A), bTack: tackName(B) };
        };
        out.onLine = hit(2.0);
        // a second contact in the same window costs nothing more
        state.time += WORLD_CLOCK * 3; window.checkBoatCollisions(1 / 60);
        out.again = { bFinish: B.raceState.finishTime };
        out.faded = hit(0);
        return out;
    });
    check('[pre] A starboard, B port and in contact', fin.onLine.aTack === 'starboard' && fin.onLine.bTack === 'port', JSON.stringify(fin.onLine));
    check('finished boat still on the line fouls a racer: +15 s, the racer unpenalized', fin.onLine.bFinish === 215 && fin.onLine.bPens === 1 && !fin.onLine.aPen, JSON.stringify(fin.onLine));
    check('...once only', fin.again.bFinish === 215, JSON.stringify(fin.again));
    check('a boat that has left the line (faded) is not penalized', fin.faded.bFinish === 200 && fin.faded.bPens === 0, JSON.stringify(fin.faded));

    // ── 4. 44.1(a): mark then boat in one incident ─────────────────────────────────────────────
    const fold = await page.evaluate(() => {
        const { A, B, far, reset } = window.__x;
        const run = (gapS) => {
            reset(A, far.x, far.y, 0);
            triggerPenalty(A, { rule: 'Rule 31', kind: 'contact', with: 'mark:0' });
            state.time += WORLD_CLOCK * gapS;
            triggerPenalty(A, { rule: 'Rule 10', kind: 'contact', with: B });
            return A.raceState.penaltyTurnsOwed;
        };
        return { pen: settings.penaltiesEnabled, within: run(1.5), apart: run(3.0) };
    });
    check('[pre] penalties enabled', fold.pen === true, JSON.stringify(fold));
    check('44.1(a): mark touch then a boat foul 1.5 s later — one turn', fold.within === 1, JSON.stringify(fold));
    check('...3 s apart they are two incidents — two turns', fold.apart === 2, JSON.stringify(fold));

    // ── 5. a rounding is not a penalty being taken ─────────────────────────────────────────────
    const take = await page.evaluate(() => {
        const { A, B, far, mIdx, headingFor, reset } = window.__x;
        const mark = state.course.marks[mIdx];
        const run = (x, y, rot) => {
            Rules.interactions = {};
            reset(A, x, y, 0); reset(B, x + 200, y, 0);
            headingFor(A, 'starboard'); headingFor(B, 'port');
            A.raceState.penalty = true; A.raceState.penaltyTurnsOwed = 1; A.raceState.penaltyRot = rot;
            const r = Rules.evaluate(A, B);
            return { row: r.rowBoat && r.rowBoat.name, rule: r.rule, inZone: Rules.inZone(A, mark) };
        };
        const z = Rules.zoneOf(mark) * 0.5;
        return { A: A.name, B: B.name,
            zoneMid: run(mark.x + z, mark.y, 2.5), zoneFull: run(mark.x + z, mark.y, 3.9), open: run(far.x, far.y, 2.5) };
    });
    check('[pre] in the zone, and in open water', take.zoneMid.inZone && !take.open.inZone, JSON.stringify(take));
    check('143° into a rounding with a turn owed — not "taking" (keeps Rule 10)', take.zoneMid.rule !== 'Rule 21' && take.zoneMid.row === take.A, JSON.stringify(take.zoneMid));
    check('223° in the zone — the rounding extended into the turn — taking', take.zoneFull.rule === 'Rule 21' && take.zoneFull.row === take.B, JSON.stringify(take.zoneFull));
    check('143° in open water — taking', take.open.rule === 'Rule 21' && take.open.row === take.B, JSON.stringify(take.open));

    // ── 6. an ended mark-room entitlement stays ended ──────────────────────────────────────────
    const spent = await page.evaluate(() => {
        const { A, B, leg, mIdx, reset } = window.__x;
        const mark = state.course.marks[mIdx];
        const key = [A.id, B.id].sort((a, b) => a - b).join('-');
        const z = Rules.zoneOf(mark);
        const setup = () => {
            Rules.interactions = {};
            reset(A, mark.x + z * 0.4, mark.y, 0); reset(B, mark.x + z * 0.4 + 40, mark.y + 10, 0);
            A.heading = B.heading = 0; A.raceState.leg = B.raceState.leg = leg;
            Rules.update(1 / 60);
            const d = Rules.interactions[key];
            if (d) d.zoneSnapshot = { markIndex: mIdx, time: state.time, overlapped: true, entitled: A.id, reason: 'Inside Overlapped' };
            return !!d;
        };
        const snap = () => { const d = Rules.interactions[key]; return d && d.zoneSnapshot ? { entitled: d.zoneSnapshot.entitled === A.id ? 'A' : d.zoneSnapshot.entitled === B.id ? 'B' : null, reason: d.zoneSnapshot.reason } : null; };
        const out = { pairOk: setup(), bothIn: Rules.inZone(A, mark) && Rules.inZone(B, mark) };
        A.raceState.isTacking = true; Rules.update(1 / 60); out.tacked = snap();
        A.raceState.isTacking = false; for (let i = 0; i < 5; i++) Rules.update(1 / 60); out.after = snap();
        // the entitled boat sails out of the zone, the other is still in it
        setup(); A.x = mark.x + z * 1.5; Rules.update(1 / 60); out.left = snap();
        for (let i = 0; i < 5; i++) Rules.update(1 / 60); out.leftAfter = snap();
        out.bStillIn = Rules.inZone(B, mark);
        return out;
    });
    check('[pre] pair tracked, both in the zone', spent.pairOk && spent.bothIn, JSON.stringify(spent));
    check('the entitled boat tacks in the zone — entitlement ends', spent.tacked && spent.tacked.entitled === null, JSON.stringify(spent.tacked));
    check('...and is NOT re-latched as a fresh zone entry', spent.after && spent.after.entitled === null, JSON.stringify(spent.after));
    check('[pre] the other boat still in the zone', spent.bStillIn, JSON.stringify(spent));
    check('the entitled boat leaves the zone — the other boat is not handed mark-room', spent.leftAfter && spent.leftAfter.entitled === null, JSON.stringify(spent.leftAfter));

    // ── 7. RRS 16.1 at contact ─────────────────────────────────────────────────────────────────
    const r16 = await page.evaluate(() => {
        const { A, B, far, headingFor, reset } = window.__x;
        const SPD = 1.5;   // u a frame: 90 u/s, ~6 kt
        const run = (turnInto) => {
            Rules.interactions = {};
            reset(A, far.x, far.y, 0); reset(B, far.x, far.y, 0);
            const h0 = headingFor(A, 'starboard');
            // the turn keeps her on starboard, off the wind
            let d = 25 * Math.PI / 180;
            A.heading = h0 + d; if (Rules.getTack(A) !== 1 || Math.abs(normalizeAngle(A.heading - getWindAt(A.x, A.y).direction)) < 50 * Math.PI / 180) d = -d;
            A.heading = h0;
            const f0 = { x: Math.sin(h0), y: -Math.cos(h0) }, h1 = h0 + d, f1 = { x: Math.sin(h1), y: -Math.cos(h1) };
            // B lies still on port where A's TURNED course goes (or, the control, on her held course)
            const P = turnInto ? { x: A.x + f0.x * 45 + f1.x * 150, y: A.y + f0.y * 45 + f1.y * 150 }
                               : { x: A.x + f0.x * 195, y: A.y + f0.y * 195 };
            B.x = P.x; B.y = P.y; headingFor(B, 'port'); B.speed = 0; B.velocity = { x: 0, y: 0 };
            for (const bt of [A, B]) { Rules._lastTack[bt.id] = Rules.getTack(bt); delete Rules._tackFlipT[bt.id]; }
            window.resetKeepClear();
            const pens = [], prev = window.onRaceEvent;
            window.onRaceEvent = (k, e) => { if (k === 'penalty') pens.push({ who: e.boat.name, rule: e.rule }); };
            let frames = 0;
            for (; frames < 300 && !pens.length; frames++) {
                if (turnInto && frames === 30) A.heading = h1;
                A.velocity = { x: Math.sin(A.heading) * SPD, y: -Math.cos(A.heading) * SPD }; A.speed = SPD;
                A.x += A.velocity.x; A.y += A.velocity.y;
                state.time += WORLD_CLOCK / 60; Rules.update(1 / 60);
                window.checkBoatCollisions(1 / 60);
            }
            window.onRaceEvent = prev;
            return { pens, s: frames / 60, aTack: tackName(A), bTack: tackName(B), A: A.name, B: B.name };
        };
        return { into: run(true), held: run(false) };
    });
    check('[pre] A starboard, B port, contact made both ways', r16.into.aTack === 'starboard' && r16.into.bTack === 'port' && r16.into.pens.length && r16.held.pens.length, JSON.stringify(r16));
    check('RRS 16.1: A turns into B, whom her course would have missed — A penalized (Rule 16)',
        r16.into.pens.length === 1 && r16.into.pens[0].who === r16.into.A && r16.into.pens[0].rule === 'Rule 16', JSON.stringify(r16.into));
    check('...control: A holds her course into B lying in it — B penalized (Rule 10)',
        r16.held.pens.length === 1 && r16.held.pens[0].who === r16.held.B && r16.held.pens[0].rule === 'Rule 10', JSON.stringify(r16.held));

    // ── 8. RRS 15 from clear astern ────────────────────────────────────────────────────────────
    const r15a = await page.evaluate(() => {
        const { A, B, far, headingFor, reset } = window.__x;
        const run = (aheadS) => {
            const tick = (n) => { for (let i = 0; i < n; i++) { state.time += WORLD_CLOCK / 60; Rules.update(1 / 60); } };
            for (const side of [1, -1]) {
                Rules.interactions = {};
                reset(A, far.x, far.y, 0); reset(B, far.x, far.y, 0);
                const h = headingFor(A, 'starboard'); B.heading = h;
                const f = { x: Math.sin(h), y: -Math.cos(h) }, sb = { x: Math.cos(h), y: Math.sin(h) };
                const at = (along) => { B.x = A.x + f.x * along + sb.x * side * 40; B.y = A.y + f.y * along + sb.y * side * 40; };
                for (const bt of [A, B]) { Rules._lastTack[bt.id] = Rules.getTack(bt); delete Rules._tackFlipT[bt.id]; }
                at(-75); tick(1);
                const astern = Rules.evaluate(A, B);
                tick(Math.round(aheadS * 60));
                at(-20); tick(1);
                const over = Rules.evaluate(A, B);
                if (over.rowBoat !== B) continue;   // B went to windward: try the other side
                return { asternRow: astern.rowBoat && astern.rowBoat.name, asternRule: astern.rule,
                         row: over.rowBoat.name, rule: over.rule, r15: over.constraints.indexOf('Rule 15') !== -1, A: A.name, B: B.name };
            }
            return null;
        };
        return { held: run(1.5), flicker: run(0.4) };
    });
    check('[pre] B clear astern (Rule 12, A), then overlapped to leeward (Rule 11, B)',
        !!(r15a.held && r15a.held.asternRule === 'Rule 12' && r15a.held.asternRow === r15a.held.A && r15a.held.rule === 'Rule 11' && r15a.held.row === r15a.held.B), JSON.stringify(r15a));
    check('RRS 15: a leeward overlap from clear astern — B owes room initially', !!(r15a.held && r15a.held.r15), JSON.stringify(r15a.held));
    check('...not when the boat ahead had held her rights under 1 s (an overlap flicker)', !!(r15a.flicker && r15a.flicker.rule === 'Rule 11' && !r15a.flicker.r15), JSON.stringify(r15a.flicker));

    // ── 9. mark-room is room, not immunity ─────────────────────────────────────────────────────
    const mrb = await page.evaluate(() => {
        const { A, B, leg, mIdx, headingFor, reset } = window.__x;
        const mark = state.course.marks[mIdx];
        const key = [A.id, B.id].sort((a, b) => a - b).join('-');
        Rules.interactions = {};
        reset(A, mark.x, mark.y, 0); reset(B, mark.x, mark.y, 0);
        const h = headingFor(B, 'starboard'); A.heading = h;
        A.raceState.leg = B.raceState.leg = leg;
        const sb = { x: Math.cos(h), y: Math.sin(h) };
        const put = (bt, lat) => { bt.x = mark.x + sb.x * lat; bt.y = mark.y + sb.y * lat; };
        put(B, 80); put(A, 30);
        Rules.update(1 / 60);
        const d = Rules.interactions[key];
        if (d) d.zoneSnapshot = { markIndex: mIdx, time: state.time, overlapped: true, entitled: A.id, reason: 'Inside Overlapped' };
        const mr = () => { const r = Rules.evaluate(A, B); return { mr: r.markRoom === A.id ? 'A' : r.markRoom === B.id ? 'B' : null, out: r.outsideMarkRoom === A.id }; };
        const out = { tracked: !!d, sameTack: tackName(A) === tackName(B), inside: mr() };
        put(A, 130); out.wideIn = Rules.inZone(A, mark); out.wide = mr();
        put(A, 30); out.back = mr();
        return out;
    });
    check('[pre] pair tracked, same tack, the swung-out boat still in the zone', mrb.tracked && mrb.sameTack && mrb.wideIn, JSON.stringify(mrb));
    check('entitled boat inside the other — mark-room', mrb.inside.mr === 'A', JSON.stringify(mrb.inside));
    check('Case 118: swung out past the boat owing room — outside mark-room, Section A decides', mrb.wide.mr === null && mrb.wide.out, JSON.stringify(mrb.wide));
    check('...back inside — her room again (the entitlement is not spent)', mrb.back.mr === 'A', JSON.stringify(mrb.back));

    await browser.close();
    console.log(fails ? `\n${fails} FAILED` : '\nAll rules-correction cases pass.');
    process.exit(fails ? 1 : 0);
})();
